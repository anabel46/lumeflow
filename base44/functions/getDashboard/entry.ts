import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Token Manager ────────────────────────────────────────────────────────────
const MARGIN_MS = 60_000;
let _cachedToken = null;
let _expiresAt = 0;

async function getValidToken() {
  if (_cachedToken && Date.now() < _expiresAt - MARGIN_MS) return _cachedToken;
  return refreshToken();
}

async function refreshToken() {
  const oauthUrl = Deno.env.get("SANKHYA_OAUTH_URL");
  const clientId = Deno.env.get("SANKHYA_CLIENT_ID");
  const clientSecret = Deno.env.get("SANKHYA_CLIENT_SECRET");
  const xToken = Deno.env.get("SANKHYA_X_TOKEN");

  if (!oauthUrl || !clientId || !clientSecret || !xToken) {
    throw new Error("Variáveis Sankhya ausentes no .env");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(oauthUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Token": xToken },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Auth Sankhya falhou: ${await res.text()}`);

  const data = await res.json();
  _cachedToken = data.access_token;
  _expiresAt = Date.now() + data.expires_in * 1000;
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
    res = await fetch(url, { ...options, headers: makeHeaders(await refreshToken()) });
  }
  return res;
}

// ── SQL ──────────────────────────────────────────────────────────────────────
function getSql(opId) {
  const filtroOp = opId ? `WHERE P.IDIPROC = ${Number(opId)}` : "";

  return `SELECT
    COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO,
    P.IDIPROC,
    P.STATUSPROC AS SITUACAO_GERAL,
    A.IDIATV,
    A.IDEFX,
    FX.DESCRICAO AS DESCRICAO_ATIVIDADE,
    CASE
        WHEN A.DHACEITE IS NULL THEN 'Aguardando aceite'
        WHEN (SELECT COUNT(1) FROM TPREIATV E WHERE E.IDIATV = A.IDIATV AND E.TIPO IN ('P', 'T', 'S') AND E.DHFINAL IS NULL) > 0 THEN 'Em andamento'
        ELSE 'Finalizada'
    END AS SITUACAO_ATIV,
    A.DHINCLUSAO,
    A.DHACEITE,
    A.DHINICIO,
    ITE.CODPROD,
    PRO.DESCRPROD,
    PRO.REFERENCIA
FROM TPRIPROC P
INNER JOIN TPRIATV A ON A.IDIPROC = P.IDIPROC
LEFT JOIN TPREFX FX ON FX.IDEFX = A.IDEFX
LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = P.NUNOTA
LEFT JOIN (
    SELECT NUNOTA, MIN(CODPROD) AS CODPROD
    FROM TGFITE
    GROUP BY NUNOTA
) ITE ON ITE.NUNOTA = P.NUNOTA
LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
${filtroOp}
ORDER BY NUMPEDIDO DESC, P.IDIPROC, A.IDIATV`;
}

// ── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const urlObj = new URL(req.url);
    const opParam = urlObj.searchParams.get("op");

    const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
    const urlSankhya = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

    const res = await fetchSankhya(urlSankhya, {
      method: "POST",
      body: JSON.stringify({
        serviceName: "DbExplorerSP.executeQuery",
        requestBody: { sql: getSql(opParam) },
      }),
    });

    const json = await res.json();
    if (String(json.status) !== "1") throw new Error(json.statusMessage);

    const pedidosMap = converterParaMap(json);

    return Response.json({
      pedidos: pedidosMap,
      estatisticas: calcularEstatisticas(pedidosMap),
    });
  } catch (error) {
    console.error("❌ Erro:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function converterParaMap(json) {
  const body = json.responseBody;
  if (!body || !body.rows) return {};

  const meta = body.fieldsMetadata;
  const colIndex = {};
  meta.forEach((m, i) => colIndex[m.name.toUpperCase()] = i);

  const resultado = {};

  for (const row of body.rows) {
    const pedido = getLong(row, colIndex, "NUMPEDIDO");
    const op = getLong(row, colIndex, "IDIPROC");
    if (!pedido || !op) continue;

    const cPed = String(pedido);
    const cOp = String(op);

    if (!resultado[cPed]) resultado[cPed] = {};
    if (!resultado[cPed][cOp]) {
      resultado[cPed][cOp] = {
        numeroPedido: pedido,
        numeroOp: op,
        situacaoGeral: getString(row, colIndex, "SITUACAO_GERAL"),
        atividades: [],
        produtos: [],
      };
    }

    const currentOp = resultado[cPed][cOp];

    // Adiciona Atividade com IDEFX (Deduplicada por IDIATV)
    const idAtiv = getString(row, colIndex, "IDIATV");
    if (idAtiv && !currentOp.atividades.some(a => a.id === idAtiv)) {
      currentOp.atividades.push({
        id: idAtiv,
        idefx: getString(row, colIndex, "IDEFX"),
        descricao: getString(row, colIndex, "DESCRICAO_ATIVIDADE"),
        situacao: getString(row, colIndex, "SITUACAO_ATIV"),
        dhInclusao: getString(row, colIndex, "DHINCLUSAO"),
        dhAceite: getString(row, colIndex, "DHACEITE"),
        dhInicio: getString(row, colIndex, "DHINICIO"),
      });
    }

    // Adiciona Produto (Deduplicado)
    const codProd = getLong(row, colIndex, "CODPROD");
    if (codProd && !currentOp.produtos.some(p => p.codigo === codProd)) {
      currentOp.produtos.push({
        codigo: codProd,
        descricao: getString(row, colIndex, "DESCRPROD"),
        referencia: getString(row, colIndex, "REFERENCIA"),
      });
    }
  }
  return resultado;
}

function calcularEstatisticas(pedidosMap) {
  const stats = { totalOps: 0, aguardando: 0, emAndamento: 0, finalizadas: 0 };
  Object.values(pedidosMap).forEach(ops => {
    Object.values(ops).forEach(op => {
      stats.totalOps++;
      if (op.situacaoGeral === "P") stats.aguardando++;
      else if (op.situacaoGeral === "A") stats.emAndamento++;
      else if (op.situacaoGeral === "F") stats.finalizadas++;
    });
  });
  return stats;
}

function getLong(row, idx, col) {
  const v = row[idx[col.toUpperCase()]];
  if (v === undefined || v === null || v === "") return null;
  return Number(String(v).replace(/\D/g, ""));
}

function getString(row, idx, col) {
  const v = row[idx[col.toUpperCase()]];
  return v !== undefined && v !== null ? String(v).trim() : "";
}