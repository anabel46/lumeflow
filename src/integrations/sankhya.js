/**
 * Integração com API Sankhya via OAuth2
 * Variáveis de ambiente necessárias (prefixo VITE_ para Vite/Base44):
 *   VITE_SANKHYA_OAUTH_URL
 *   VITE_SANKHYA_CLIENT_ID
 *   VITE_SANKHYA_CLIENT_SECRET
 *   VITE_SANKHYA_X_TOKEN
 *   VITE_SANKHYA_BASE_URL
 */

// ─── Configuração ──────────────────────────────────────────────────────────────
const OAUTH_URL = import.meta.env.VITE_SANKHYA_OAUTH_URL;
const CLIENT_ID = import.meta.env.VITE_SANKHYA_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_SANKHYA_CLIENT_SECRET;
const X_TOKEN = import.meta.env.VITE_SANKHYA_X_TOKEN;
const BASE_URL = import.meta.env.VITE_SANKHYA_BASE_URL;

// ─── Token Manager ─────────────────────────────────────────────────────────────
let _tokenCache = null; // { access_token, expires_at }

async function refreshToken() {
  if (!OAUTH_URL || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Sankhya: variáveis de ambiente OAuth não configuradas (VITE_SANKHYA_OAUTH_URL, VITE_SANKHYA_CLIENT_ID, VITE_SANKHYA_CLIENT_SECRET)");
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const response = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(X_TOKEN ? { "X-Token": X_TOKEN } : {}),
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sankhya OAuth falhou (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Sankhya OAuth: resposta sem access_token");
  }

  const expiresIn = data.expires_in ?? 3600;
  _tokenCache = {
    access_token: data.access_token,
    expires_at: Date.now() + (expiresIn - 60) * 1000, // margem de 60s
  };

  return _tokenCache.access_token;
}

async function getValidToken() {
  if (_tokenCache && Date.now() < _tokenCache.expires_at) {
    return _tokenCache.access_token;
  }
  return refreshToken();
}

// ─── Fetch Wrapper ─────────────────────────────────────────────────────────────
async function fetchSankhya(url, options = {}, retry = true) {
  const token = await getValidToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(X_TOKEN ? { "X-Token": X_TOKEN } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 && retry) {
    // Token expirou: força renovação e tenta uma vez
    _tokenCache = null;
    return fetchSankhya(url, options, false);
  }

  return response;
}

// ─── Executor SQL ──────────────────────────────────────────────────────────────
async function executarSQL(sql) {
  if (!BASE_URL) {
    throw new Error("Sankhya: VITE_SANKHYA_BASE_URL não configurada");
  }

  const url = `${BASE_URL}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

  const body = {
    serviceName: "DbExplorerSP.executeQuery",
    requestBody: { sql },
  };

  const response = await fetchSankhya(url, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sankhya SQL falhou (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (data.status !== "1") {
    throw new Error(`Sankhya SQL erro: ${data.statusMessage || JSON.stringify(data)}`);
  }

  const { rows = [], fieldsMetadata = [] } = data.responseBody ?? {};

  // Converte array de arrays em array de objetos usando fieldsMetadata
  return rows.map((row) => {
    const obj = {};
    fieldsMetadata.forEach((field, i) => {
      obj[field.name] = row[i] ?? null;
    });
    return obj;
  });
}

// ─── SQL das OPs ───────────────────────────────────────────────────────────────
const SQL_OPS_ATIVAS = `
SELECT
  COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO,
  P.IDIPROC,
  P.STATUSPROC AS SITUACAO_GERAL,
  A.IDIATV,
  A.IDEFX,
  CASE
    WHEN A.DHACEITE IS NULL THEN 'Aguardando aceite'
    WHEN (
      SELECT COUNT(1) FROM TPREIATV E
      WHERE E.IDIATV = A.IDIATV
        AND E.[TIPO] IN ('P','T','S')
        AND E.DHFINAL IS NULL
    ) > 0 THEN 'Em andamento'
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
LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = P.NUNOTA
LEFT JOIN TGFITE ITE ON ITE.NUNOTA = P.NUNOTA
LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
WHERE P.STATUSPROC = 'A'
ORDER BY NUMPEDIDO DESC, P.IDIPROC, A.IDIATV
`.trim();

// ─── Funções de Negócio ────────────────────────────────────────────────────────

/**
 * Busca todas as OPs ativas no Sankhya.
 * @returns {Promise<Array>}
 */
export async function getSankhyaOps() {
  return executarSQL(SQL_OPS_ATIVAS);
}

/**
 * Mesmo resultado de getSankhyaOps mas agrupado:
 * { [NUMPEDIDO]: { [IDIPROC]: [atividades] } }
 */
export async function getOpsPorPedido() {
  const rows = await executarSQL(SQL_OPS_ATIVAS);

  const grouped = {};
  for (const row of rows) {
    const pedido = row.NUMPEDIDO ?? "sem_pedido";
    const idiproc = row.IDIPROC ?? "sem_proc";

    if (!grouped[pedido]) grouped[pedido] = {};
    if (!grouped[pedido][idiproc]) grouped[pedido][idiproc] = [];

    grouped[pedido][idiproc].push(row);
  }

  return grouped;
}

/**
 * Busca uma OP específica pelo IDIPROC.
 * @param {number|string} idiproc
 */
export async function getOp(idiproc) {
  const sql = `
    SELECT
      COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO,
      P.IDIPROC,
      P.STATUSPROC AS SITUACAO_GERAL,
      A.IDIATV,
      A.IDEFX,
      CASE
        WHEN A.DHACEITE IS NULL THEN 'Aguardando aceite'
        WHEN (
          SELECT COUNT(1) FROM TPREIATV E
          WHERE E.IDIATV = A.IDIATV
            AND E.[TIPO] IN ('P','T','S')
            AND E.DHFINAL IS NULL
        ) > 0 THEN 'Em andamento'
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
    LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = P.NUNOTA
    LEFT JOIN TGFITE ITE ON ITE.NUNOTA = P.NUNOTA
    LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
    WHERE P.IDIPROC = ${Number(idiproc)}
    ORDER BY A.IDIATV
  `.trim();

  return executarSQL(sql);
}

/**
 * Retorna totais/dashboard: total OPs ativas, por situação e aguardando aceite.
 */
export async function getDashboard() {
  const rows = await executarSQL(SQL_OPS_ATIVAS);

  const totalOps = new Set(rows.map((r) => r.IDIPROC)).size;
  const aguardandoAceite = rows.filter((r) => r.SITUACAO_ATIV === "Aguardando aceite").length;
  const emAndamento = rows.filter((r) => r.SITUACAO_ATIV === "Em andamento").length;
  const finalizada = rows.filter((r) => r.SITUACAO_ATIV === "Finalizada").length;

  const porSituacao = rows.reduce((acc, r) => {
    const sit = r.SITUACAO_ATIV || "Desconhecida";
    acc[sit] = (acc[sit] || 0) + 1;
    return acc;
  }, {});

  return {
    totalOps,
    aguardandoAceite,
    emAndamento,
    finalizada,
    porSituacao,
    totalAtividades: rows.length,
  };
}

/**
 * Atualiza o STATUSPROC de uma OP.
 * @param {number|string} idiproc
 * @param {string} novoStatus  ex: 'A', 'F', 'C'
 */
export async function atualizarStatus(idiproc, novoStatus) {
  const sql = `
    UPDATE TPRIPROC SET STATUSPROC = '${novoStatus}'
    WHERE IDIPROC = ${Number(idiproc)}
  `.trim();

  return executarSQL(sql);
}