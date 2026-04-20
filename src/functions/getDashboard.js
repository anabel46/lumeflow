// deno-lint-ignore no-undef
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Configuração ──────────────────────────────────────────────────────────────
const OAUTH_URL = Deno.env.get("SANKHYA_OAUTH_URL");
const CLIENT_ID = Deno.env.get("SANKHYA_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("SANKHYA_CLIENT_SECRET");
const X_TOKEN = Deno.env.get("SANKHYA_X_TOKEN");
const BASE_URL = Deno.env.get("SANKHYA_BASE_URL");

let _tokenCache = null;

async function getValidToken() {
  if (_tokenCache && Date.now() < _tokenCache.expires_at) {
    return _tokenCache.access_token;
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
    expires_at: Date.now() + (expiresIn - 60) * 1000,
  };

  return _tokenCache.access_token;
}

async function executarSQL(sql) {
  const token = await getValidToken();

  const url = `${BASE_URL}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

  const body = {
    serviceName: "DbExplorerSP.executeQuery",
    requestBody: { sql },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(X_TOKEN ? { "X-Token": X_TOKEN } : {}),
    },
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

  return rows.map((row) => {
    const obj = {};
    fieldsMetadata.forEach((field, i) => {
      obj[field.name] = row[i] ?? null;
    });
    return obj;
  });
}

// ─── Handler ────────────────────────────────────────────────────────────────────
// deno-lint-ignore no-undef
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!OAUTH_URL || !CLIENT_ID || !CLIENT_SECRET || !BASE_URL) {
      return Response.json(
        { error: "Sankhya: variáveis de ambiente não configuradas" },
        { status: 500 }
      );
    }

    const sql = `
SELECT COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO, P.IDIPROC, P.STATUSPROC AS SITUACAO_GERAL, A.IDIATV, A.IDEFX, CASE WHEN A.DHACEITE IS NULL THEN 'Aguardando aceite' WHEN (SELECT COUNT(1) FROM TPREIATV E WHERE E.IDIATV = A.IDIATV AND E.[TIPO] IN ('P','T','S') AND E.DHFINAL IS NULL) > 0 THEN 'Em andamento' ELSE 'Finalizada' END AS SITUACAO_ATIV, A.DHINCLUSAO, A.DHACEITE, A.DHINICIO, ITE.CODPROD, PRO.DESCRPROD, PRO.REFERENCIA FROM TPRIPROC P INNER JOIN TPRIATV A ON A.IDIPROC = P.IDIPROC LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = P.NUNOTA LEFT JOIN TGFITE ITE ON ITE.NUNOTA = P.NUNOTA LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD WHERE P.STATUSPROC = 'A' ORDER BY NUMPEDIDO DESC, P.IDIPROC, A.IDIATV
    `.trim();

    const rows = await executarSQL(sql);

    // Agrupar por pedido
    const grouped = {};
    for (const row of rows) {
      const pedido = row.NUMPEDIDO ?? "sem_pedido";
      if (!grouped[pedido]) {
        grouped[pedido] = [];
      }
      grouped[pedido].push(row);
    }

    // Estatísticas
    const totalOps = new Set(rows.map((r) => r.IDIPROC)).size;
    const aguardandoAceite = rows.filter((r) => r.SITUACAO_ATIV === "Aguardando aceite").length;
    const emAndamento = rows.filter((r) => r.SITUACAO_ATIV === "Em andamento").length;
    const finalizada = rows.filter((r) => r.SITUACAO_ATIV === "Finalizada").length;

    return Response.json({
      ops: rows,
      opsPorPedido: grouped,
      dashboard: {
        totalOps,
        aguardandoAceite,
        emAndamento,
        finalizada,
        totalAtividades: rows.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});