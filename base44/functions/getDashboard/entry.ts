import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Token Manager ────────────────────────────────────────────────────────────
const MARGIN_MS = 60_000;
let _cachedToken = null;
let _expiresAt = 0;

async function getValidToken() {
  if (_cachedToken && Date.now() < _expiresAt - MARGIN_MS) {
    return _cachedToken;
  }
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
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Token": xToken,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth Sankhya falhou (${res.status}): ${text}`);
  }

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

  let res = await fetch(url, { 
    ...options, 
    headers: makeHeaders(token) 
  });

  if (res.status === 401) {
    _cachedToken = null;
    const fresh = await refreshToken();
    res = await fetch(url, { 
      ...options, 
      headers: makeHeaders(fresh) 
    });
  }

  return res;
}

// ── SQL Query ────────────────────────────────────────────────────────────────
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

ORDER BY NUMPEDIDO DESC, P.IDIPROC, A.IDIATV`;

// ── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
    if (!baseUrl) throw new Error("SANKHYA_BASE_URL não configurada");

    // Chamada ao Sankhya
    const url = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;
    const res = await fetchSankhya(url, {
      method: "POST",
      body: JSON.stringify({
        serviceName: "DbExplorerSP.executeQuery",
        requestBody: { sql: SQL_OPERACOES },
      }),
    });

    const json = await res.json();
    if (String(json.status) !== "1") {
      throw new Error(`Sankhya erro: ${json.statusMessage}`);
    }

    // Processa resultado
    const pedidosMap = converterParaMap(json);
    const estatisticas = calcularEstatisticas(pedidosMap);

    return Response.json({
      pedidos: pedidosMap,
      estatisticas,
    });
  } catch (error) {
    console.error("❌ Erro em getDashboard:", error.message);
    return Response.json({ 
      error: error.message,
      pedidos: {},
      estatisticas: {}
    }, { status: 500 });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function converterParaMap(json) {
  const body = json.responseBody;
  if (!body || !body.rows) return {};

  const rows = body.rows;
  const meta = body.fieldsMetadata;

  const colIndex = {};
  for (let i = 0; i < meta.length; i++) {
    colIndex[meta[i].name.toUpperCase()] = i;
  }

  const resultado = {};

  for (const row of rows) {
    const pedido = getLong(row, colIndex, "NUMPEDIDO");
    const op = getLong(row, colIndex, "IDIPROC");
    
    if (pedido == null || op == null) continue;

    const cPed = String(pedido);
    const cOp = String(op);

    if (!resultado[cPed]) resultado[cPed] = {};

    if (!resultado[cPed][cOp]) {
      resultado[cPed][cOp] = {
        numeroPedido: pedido,
        numeroOp: op,
        situacaoGeral: getString(row, colIndex, "SITUACAO_GERAL"),
        descricaoAtividade: getString(row, colIndex, "DESCRICAO_ATIVIDADE"),
        produtos: [],
        atividades: [],
      };
    }

    const opMap = resultado[cPed][cOp];

    // Adiciona atividade
    const idAtiv = getString(row, colIndex, "IDIATV");
    const descAtiv = getString(row, colIndex, "DESCRICAO_ATIVIDADE");
    if (idAtiv !== "" && !opMap.atividades.some((a) => a.id === idAtiv)) {
      opMap.atividades.push({
        id: idAtiv,
        descricao: descAtiv || idAtiv,
        situacao: getString(row, colIndex, "SITUACAO_ATIV"),
      });
    }

    // Adiciona produto
    const codProd = getLong(row, colIndex, "CODPROD");
    if (codProd != null && !opMap.produtos.some((p) => p.codigo === codProd)) {
      opMap.produtos.push({
        codigo: codProd,
        descricao: getString(row, colIndex, "DESCRPROD"),
        referencia: getString(row, colIndex, "REFERENCIA"),
      });
    }
  }

  return resultado;
}

function calcularEstatisticas(pedidosMap) {
  const stats = {
    totalOps: 0,
    aguardando: 0,
    emAndamento: 0,
    finalizadas: 0,
  };

  Object.values(pedidosMap).forEach((opsMap) => {
    Object.values(opsMap).forEach((op) => {
      stats.totalOps++;
      if (op.situacaoGeral === "P") stats.aguardando++;
      else if (op.situacaoGeral === "A") stats.emAndamento++;
      else if (op.situacaoGeral === "F") stats.finalizadas++;
    });
  });

  return stats;
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
  return (v == null) ? "" : String(v).trim();
}