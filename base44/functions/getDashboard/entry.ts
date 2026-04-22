// ── Token Manager ────────────────────────────────────────────────────────────
const MARGIN_MS = 60_000;
let _cachedToken = null;
let _expiresAt = 0;

async function getValidToken() {
  if (_cachedToken && Date.now() < _expiresAt - MARGIN_MS) return _cachedToken;
  return refreshToken();
}

async function refreshToken() {
  const oauthUrl     = Deno.env.get("SANKHYA_OAUTH_URL");
  const clientId     = Deno.env.get("SANKHYA_CLIENT_ID");
  const clientSecret = Deno.env.get("SANKHYA_CLIENT_SECRET");
  const xToken       = Deno.env.get("SANKHYA_X_TOKEN");

  if (!oauthUrl || !clientId || !clientSecret || !xToken) {
    throw new Error("Variáveis de ambiente Sankhya ausentes (OAUTH_URL, CLIENT_ID, CLIENT_SECRET, X_TOKEN)");
  }

  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 15_000);

  let res;
  try {
    res = await fetch(oauthUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Token": xToken },
      body:    body.toString(),
      signal:  controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth Sankhya falhou (${res.status}): ${text}`);
  }

  const data    = await res.json();
  _cachedToken  = data.access_token;
  _expiresAt    = Date.now() + data.expires_in * 1000;
  console.log("Token obtido! Expira em:", data.expires_in, "s");
  return _cachedToken;
}

async function fetchSankhya(url, options = {}) {
  const token = await getValidToken();

  const makeHeaders = (t) => ({
    ...(options.headers || {}),
    "Authorization": `Bearer ${t}`,
    "Content-Type":  "application/json",
  });

  // Timeout de 25s para queries pesadas
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 25_000);

  // Remove signal de options para não conflitar
  const { signal: _ignored, ...restOptions } = options;

  try {
    let res = await fetch(url, {
      ...restOptions,
      headers: makeHeaders(token),
      signal:  controller.signal,
    });

    if (res.status === 401) {
      console.log("Token expirado, renovando...");
      _cachedToken = null;
      const fresh = await refreshToken();
      res = await fetch(url, {
        ...restOptions,
        headers: makeHeaders(fresh),
        signal:  controller.signal,
      });
    }

    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// ── SQL ──────────────────────────────────────────────────────────────────────
const SQL_OPERACOES = `SELECT
    COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO,
    P.IDIPROC,
    P.STATUSPROC AS SITUACAO_GERAL,
    A.IDIATV,
    A.IDEFX,
    FX.DESCRICAO AS DESCRICAO_ATIVIDADE,
    CASE
        WHEN A.DHACEITE IS NULL THEN 'Aguardando aceite'
        WHEN (SELECT COUNT(1) FROM TPREIATV E WHERE E.IDIATV = A.IDIATV AND E.[TIPO] IN ('P', 'T', 'S') AND E.DHFINAL IS NULL) > 0 THEN 'Em andamento'
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
LEFT JOIN TGFITE ITE ON ITE.NUNOTA = P.NUNOTA
LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
WHERE P.STATUSPROC = 'A'
ORDER BY NUMPEDIDO DESC, P.IDIPROC, A.IDIATV`;
// ── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  console.log(">>> Handler iniciado", new Date().toISOString());

  try {
    // 1. Valida variável de ambiente
    const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
    if (!baseUrl) throw new Error("SANKHYA_BASE_URL não configurada");

    const url = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;
    console.log(">>> Chamando Sankhya:", url);

    // 2. Executa query no Sankhya
    const res = await fetchSankhya(url, {
      method: "POST",
      body: JSON.stringify({
        serviceName:  "DbExplorerSP.executeQuery",
        requestBody:  { sql: SQL_OPERACOES },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sankhya HTTP ${res.status}: ${text}`);
    }

    const json = await res.json();
    console.log(">>> Status Sankhya:", json.status);

    if (String(json.status) !== "1") {
      throw new Error(`Sankhya retornou erro: ${json.statusMessage}`);
    }

    // 3. Processa e retorna
    const pedidos     = converterParaMap(json);
    const estatisticas = calcularEstatisticas(pedidos);
    console.log(">>> Pedidos encontrados:", Object.keys(pedidos).length);

    return Response.json({ pedidos, estatisticas });

  } catch (error) {
    console.error(">>> ERRO em getDashboard:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function converterParaMap(json) {
  const body = json.responseBody;
  if (!body || !body.rows) {
    console.warn("Sankhya retornou sem rows:", JSON.stringify(json).substring(0, 300));
    return {};
  }

  const { rows, fieldsMetadata: meta } = body;
  const colIndex = {};
  for (let i = 0; i < meta.length; i++) colIndex[meta[i].name.toUpperCase()] = i;

  const resultado = {};
  for (const row of rows) {
    const pedido = getLong(row, colIndex, "NUMPEDIDO");
    const op     = getLong(row, colIndex, "IDIPROC");
    if (pedido == null || op == null) continue;

    const cPed = String(pedido);
    const cOp  = String(op);

if (!resultado[cPed][cOp]) {
  resultado[cPed][cOp] = {
    numeroPedido:       pedido,
    numeroOp:           op,
    situacaoGeral:      getString(row, colIndex, "SITUACAO_GERAL"),
    descricaoAtividade: getString(row, colIndex, "DESCRICAO_ATIVIDADE"), // ← novo
    produtos:           [],
    atividades:         [],
  };
}

    const opMap  = resultado[cPed][cOp];
    const idAtiv = getString(row, colIndex, "IDIATV");

if (idAtiv && !opMap.atividades.some(a => a.id === idAtiv)) {
  opMap.atividades.push({
    id:                idAtiv,
    descricao:         getString(row, colIndex, "DESCRICAO_ATIVIDADE"), // ← novo
    situacao:          getString(row, colIndex, "SITUACAO_ATIV"),
    dhAceite:          getString(row, colIndex, "DHACEITE"),
    dhInicio:          getString(row, colIndex, "DHINICIO"),
  });
}

    const codProd = getLong(row, colIndex, "CODPROD");
    if (codProd != null && !opMap.produtos.some(p => p.codigo === codProd)) {
      opMap.produtos.push({
        codigo:     codProd,
        descricao:  getString(row, colIndex, "DESCRPROD"),
        referencia: getString(row, colIndex, "REFERENCIA"),
      });
    }
  }

  return resultado;
}

function calcularEstatisticas(pedidos) {
  let totalOps = 0, aguardando = 0, emAndamento = 0, finalizadas = 0;

  for (const ops of Object.values(pedidos)) {
    for (const op of Object.values(ops)) {
      totalOps++;
      const ativs = op.atividades || [];
      const total = ativs.length;
      const fin   = ativs.filter(a => a.situacao === "Finalizada").length;
      const em    = ativs.filter(a => a.situacao === "Em andamento").length;

      if (em > 0)                          emAndamento++;
      else if (fin === total && total > 0)  finalizadas++;
      else                                  aguardando++;
    }
  }

  return { totalOps, aguardando, emAndamento, finalizadas };
}

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
  return v == null ? "" : String(v).trim();
}