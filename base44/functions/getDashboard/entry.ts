import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Token Manager ─────────────────────────────────────────────────────────────
const MARGIN_MS = 60_000;
let _cachedToken = null;
let _expiresAt = 0;

async function getValidToken() {
  if (_cachedToken && Date.now() < _expiresAt - MARGIN_MS) return _cachedToken;
  return refreshToken();
}

async function refreshToken() {
  const oauthUrl      = Deno.env.get("SANKHYA_OAUTH_URL");
  const clientId      = Deno.env.get("SANKHYA_CLIENT_ID");
  const clientSecret  = Deno.env.get("SANKHYA_CLIENT_SECRET");
  const xToken        = Deno.env.get("SANKHYA_X_TOKEN");

  if (!oauthUrl || !clientId || !clientSecret || !xToken) {
    throw new Error("Variáveis Sankhya ausentes no .env");
  }

  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(oauthUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Token": xToken },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth Sankhya falhou (${res.status}): ${text}`);
  }

  const data = await res.json();
  _cachedToken = data.access_token;
  _expiresAt   = Date.now() + data.expires_in * 1000;
  return _cachedToken;
}

async function fetchSankhya(url, options = {}) {
  const token = await getValidToken();

  const makeHeaders = (t) => ({
    ...(options.headers || {}),
    "Authorization": `Bearer ${t}`,
    "Content-Type": "application/json",
  });

  let res = await fetch(url, { ...options, headers: makeHeaders(token) });

  if (res.status === 401) {
    _cachedToken = null;
    const fresh = await refreshToken();
    res = await fetch(url, { ...options, headers: makeHeaders(fresh) });
  }

  return res;
}

// ── SQL: Fluxo Produtivo ──────────────────────────────────────────────────────
function getSqlFluxo(opId) {
  const filtroOp = opId ? `WHERE P.IDIPROC = ${Number(opId)}` : "";
  return `
SELECT
    COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO,
    P.IDIPROC,
    P.STATUSPROC       AS SITUACAO_GERAL,
    A.IDIATV,
    A.IDEFX,
    FX.CODIGO          AS CODIGO_FX,
    FX.DESCRICAO       AS DESCRICAO_ATIVIDADE,
    A.DHINCLUSAO,
    A.DHACEITE,
    A.DHINICIO,
    E.IDIEXEC,
    E.TIPO             AS TIPO_EXEC,
    E.DHINICIAL        AS EXEC_INICIO,
    E.DHFINAL          AS EXEC_FIM,
    E.QTDPROD          AS EXEC_QTD,
    CASE
        WHEN A.DHACEITE IS NULL THEN 'Aguardando aceite'
        WHEN E.IDIEXEC IS NOT NULL AND E.DHFINAL IS NULL THEN 'Em andamento'
        WHEN E.IDIEXEC IS NOT NULL AND E.DHFINAL IS NOT NULL THEN 'Finalizada'
        ELSE 'Aceita / Não iniciada'
    END AS SITUACAO_ATIV,
    ITE.CODPROD,
    PRO.DESCRPROD,
    PRO.REFERENCIA
FROM TPRIPROC P
INNER JOIN TPRIATV  A   ON A.IDIPROC  = P.IDIPROC
LEFT  JOIN TPREIATV E   ON E.IDIATV   = A.IDIATV
LEFT  JOIN TPREFX   FX  ON FX.IDEFX   = A.IDEFX
LEFT  JOIN TGFCAB   CAB ON CAB.NUNOTA = P.NUNOTA
LEFT  JOIN TGFITE   ITE ON ITE.NUNOTA = P.NUNOTA
LEFT  JOIN TGFPRO   PRO ON PRO.CODPROD = ITE.CODPROD
${filtroOp}
ORDER BY NUMPEDIDO DESC, P.IDIPROC, A.IDIATV, E.DHINICIAL`;
}

// ── SQL: BOM (Composição) ─────────────────────────────────────────────────────
function getSqlBom(opId) {
  const filtroOp = opId ? `AND P.IDIPROC = ${Number(opId)}` : "";
  return `
SELECT
    E.CODPROD       AS CODPROD_PAI,
    E.CODPRODFI     AS CODPROD_COMP,
    COMP.DESCRPROD  AS DESCR_COMP,
    COMP.REFERENCIA AS REF_COMP,
    COMP.TIPOPROD   AS TIPO_COMP,
    E.QTDNEC        AS QTD_NECESSARIA,
    E.PERDAPREV     AS PERDA_PREV,
    E.SEQITEM       AS SEQUENCIA
FROM TGFEST E
INNER JOIN TGFPRO COMP ON COMP.CODPROD = E.CODPRODFI
WHERE E.CODPROD IN (
    SELECT DISTINCT ITE.CODPROD
    FROM TPRIPROC P
    INNER JOIN TGFITE ITE ON ITE.NUNOTA = P.NUNOTA
    WHERE 1=1 ${filtroOp}
)
ORDER BY E.CODPROD, E.SEQITEM`;
}

// ── Converte retorno do Sankhya para mapa de pedidos ─────────────────────────
function converterParaMap(fluxoJson, bomJson) {
  const resultado = {};

  // 1. Processa fluxo produtivo
  const body = fluxoJson.responseBody;
  if (body?.rows) {
    const meta = body.fieldsMetadata;
    const idx = {};
    meta.forEach((m, i) => { idx[m.name.toUpperCase()] = i; });

    for (const row of body.rows) {
      const pedido = getLong(row, idx, "NUMPEDIDO");
      const op     = getLong(row, idx, "IDIPROC");
      if (!pedido || !op) continue;

      const cPed = String(pedido);
      const cOp  = String(op);

      if (!resultado[cPed]) resultado[cPed] = {};
      if (!resultado[cPed][cOp]) {
        resultado[cPed][cOp] = {
          numeroPedido:  pedido,
          numeroOp:      op,
          situacaoGeral: getString(row, idx, "SITUACAO_GERAL"),
          atividades:    [],
          produtos:      [],
        };
      }

      const currentOp = resultado[cPed][cOp];

      // Atividade com execuções reais
      const idAtiv = getString(row, idx, "IDIATV");
      let ativ = currentOp.atividades.find(a => a.id === idAtiv);
      if (!ativ) {
        ativ = {
          id:        idAtiv,
          idefx:     getString(row, idx, "IDEFX"),
          codigoFx:  getString(row, idx, "CODIGO_FX"),
          descricao: getString(row, idx, "DESCRICAO_ATIVIDADE"),
          situacao:  getString(row, idx, "SITUACAO_ATIV"),
          dhAceite:  getString(row, idx, "DHACEITE"),
          dhInicio:  getString(row, idx, "DHINICIO"),
          execucoes: [],
        };
        currentOp.atividades.push(ativ);
      }

      // Execução real desta atividade (pode haver N por atividade)
      const idExec = getString(row, idx, "IDIEXEC");
      if (idExec && !ativ.execucoes.some(e => e.id === idExec)) {
        ativ.execucoes.push({
          id:     idExec,
          tipo:   getString(row, idx, "TIPO_EXEC"),
          inicio: getString(row, idx, "EXEC_INICIO"),
          fim:    getString(row, idx, "EXEC_FIM"),
          qtd:    getLong(row,    idx, "EXEC_QTD"),
        });
        // Recalcula situação pela execução mais recente
        if (getString(row, idx, "EXEC_FIM"))  ativ.situacao = "Finalizada";
        else if (idExec)                       ativ.situacao = "Em andamento";
      }

      // Produto (deduplica)
      const codProd = getLong(row, idx, "CODPROD");
      if (codProd && !currentOp.produtos.some(p => p.codigo === codProd)) {
        currentOp.produtos.push({
          codigo:      codProd,
          descricao:   getString(row, idx, "DESCRPROD"),
          referencia:  getString(row, idx, "REFERENCIA"),
          componentes: [],
        });
      }
    }
  }

  // 2. Injeta BOM (composição) nos produtos
  const bomBody = bomJson?.responseBody;
  if (bomBody?.rows) {
    const meta = bomBody.fieldsMetadata;
    const idx  = {};
    meta.forEach((m, i) => { idx[m.name.toUpperCase()] = i; });

    const bomMap = {};
    for (const row of bomBody.rows) {
      const pai = getLong(row, idx, "CODPROD_PAI");
      if (!pai) continue;
      if (!bomMap[pai]) bomMap[pai] = [];
      bomMap[pai].push({
        codigo:     getLong(row,  idx, "CODPROD_COMP"),
        descricao:  getString(row, idx, "DESCR_COMP"),
        referencia: getString(row, idx, "REF_COMP"),
        tipo:       getString(row, idx, "TIPO_COMP"),
        qtdNec:     getLong(row,  idx, "QTD_NECESSARIA"),
        perda:      getLong(row,  idx, "PERDA_PREV"),
        sequencia:  getLong(row,  idx, "SEQUENCIA"),
      });
    }

    Object.values(resultado).forEach(ops =>
      Object.values(ops).forEach(op =>
        op.produtos.forEach(p => {
          p.componentes = bomMap[p.codigo] || [];
        })
      )
    );
  }

  return resultado;
}

// ── Estatísticas ──────────────────────────────────────────────────────────────
function calcularEstatisticas(pedidosMap) {
  let totalOps = 0, aguardando = 0, emAndamento = 0, finalizadas = 0;

  Object.values(pedidosMap).forEach(ops => {
    Object.values(ops).forEach(op => {
      totalOps++;
      const s = op.situacaoGeral;
      if (s === "F") finalizadas++;
      else if (s === "A") emAndamento++;
      else aguardando++;
    });
  });

  return { totalOps, aguardando, emAndamento, finalizadas };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getNode(row, idx, col) {
  const i = idx[col.toUpperCase()];
  return (i !== undefined && i < row.length) ? row[i] : null;
}

function getLong(row, idx, col) {
  const v = getNode(row, idx, col);
  if (v == null || v === "") return null;
  const cleaned = String(v).trim().replace(/\D/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

function getString(row, idx, col) {
  const v = getNode(row, idx, col);
  return (v == null) ? "" : String(v).trim();
}

// ── Handler Principal ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const urlObj  = new URL(req.url);
    const opParam = urlObj.searchParams.get("op");

    const baseUrl    = Deno.env.get("SANKHYA_BASE_URL");
    const urlSankhya = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

    const callSankhya = (sql) =>
      fetchSankhya(urlSankhya, {
        method: "POST",
        body: JSON.stringify({
          serviceName: "DbExplorerSP.executeQuery",
          requestBody: { sql },
        }),
      }).then(r => r.json());

    // Executa fluxo produtivo e BOM em paralelo
    const [fluxoRaw, bomRaw] = await Promise.all([
      callSankhya(getSqlFluxo(opParam)),
      callSankhya(getSqlBom(opParam)),
    ]);

    if (String(fluxoRaw.status) !== "1") throw new Error(fluxoRaw.statusMessage);

    const bomSafe = String(bomRaw.status) === "1" ? bomRaw : { responseBody: null };

    const pedidosMap = converterParaMap(fluxoRaw, bomSafe);

    return Response.json({
      pedidos:      pedidosMap,
      estatisticas: calcularEstatisticas(pedidosMap),
    });
  } catch (error) {
    console.error("❌ Erro:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});