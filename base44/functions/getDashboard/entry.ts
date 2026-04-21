// --- Interfaces e Tipos ---

interface SankhyaAtividade {
  id: string;
  situacao: string;
  dhAceite: string;
  dhInicio: string;
  temQualidade: boolean;
}

interface SankhyaProduto {
  codigo: number;
  descricao: string;
  referencia: string;
}

interface OrdemProducao {
  numeroPedido: number;
  numeroOp: number;
  situacaoGeral: string;
  produtos: SankhyaProduto[];
  atividades: SankhyaAtividade[];
}

// Estrutura: { [pedidoId: string]: { [opId: string]: OrdemProducao } }
type ResultadoAgrupado = Record<string, Record<string, OrdemProducao>>;

interface SankhyaResponse {
  status: string | number;
  statusMessage?: string;
  responseBody?: {
    rows: any[][];
    fieldsMetadata: { name: string }[];
  };
}

// --- Gerenciamento de Token ---

const MARGIN_MS = 60000;
let cachedToken: string | null = null;
let expiresAt = 0;

async function refreshToken(): Promise<string> {
  const oauthUrl = Deno.env.get("SANKHYA_OAUTH_URL");
  const clientId = Deno.env.get("SANKHYA_CLIENT_ID");
  const clientSecret = Deno.env.get("SANKHYA_CLIENT_SECRET");
  const xToken = Deno.env.get("SANKHYA_X_TOKEN");

  if (!oauthUrl || !clientId || !clientSecret || !xToken) {
    throw new Error("Variáveis de ambiente ausentes");
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
  cachedToken = data.access_token;
  expiresAt = Date.now() + (data.expires_in * 1000);
  return cachedToken as string;
}

async function getValidToken(): Promise<string> {
  if (cachedToken && Date.now() < expiresAt - MARGIN_MS) return cachedToken;
  return refreshToken();
}

async function fetchSankhya(url: string, options: RequestInit): Promise<Response> {
  const token = await getValidToken();
  
  const makeHeaders = (t: string): HeadersInit => ({
    ...(options.headers ?? {}),
    "Authorization": `Bearer ${t}`,
    "Content-Type": "application/json",
  });

  let res = await fetch(url, { ...options, headers: makeHeaders(token) });

  if (res.status === 401) {
    cachedToken = null;
    const fresh = await refreshToken();
    res = await fetch(url, { ...options, headers: makeHeaders(fresh) });
  }

  return res;
}

// --- SQL e Helpers de Extração ---

const SQL_OPERACOES = `
SELECT
    COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO,
    P.IDIPROC,
    P.STATUSPROC AS SITUACAO_GERAL,
    A.IDIATV,
    A.IDEFX,
    CASE
        WHEN A.DHACEITE IS NULL THEN 'Aguardando aceite'
        WHEN (SELECT COUNT(1) FROM TPREIATV E WHERE E.IDIATV = A.IDIATV AND E.[TIPO] IN ('P', 'T', 'S') AND E.DHFINAL IS NULL) > 0 THEN 'Em andamento'
        ELSE 'Finalizada'
    END AS SITUACAO_ATIV,
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
ORDER BY NUMPEDIDO DESC, P.IDIPROC, A.IDIATV`;

type ColIndex = Record<string, number>;

const getNode = (row: any[], idx: ColIndex, col: string): any => {
  const i = idx[col.toUpperCase()];
  return (i !== undefined && i < row.length) ? row[i] : null;
};

const getLong = (row: any[], idx: ColIndex, col: string): number | null => {
  const v = getNode(row, idx, col);
  if (v === null || v === "") return null;
  const cleaned = String(v).trim().replace(/\D/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
};

const getString = (row: any[], idx: ColIndex, col: string): string => {
  const v = getNode(row, idx, col);
  return (v === null) ? "" : String(v).trim();
};

// --- Lógica Principal ---

async function buscarProcessosPorPedido(): Promise<ResultadoAgrupado> {
  const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
  if (!baseUrl) throw new Error("SANKHYA_BASE_URL nao configurada");

  const url = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

  const res = await fetchSankhya(url, {
    method: "POST",
    body: JSON.stringify({
      serviceName: "DbExplorerSP.executeQuery",
      requestBody: { sql: SQL_OPERACOES },
    }),
  });

  const json: SankhyaResponse = await res.json();
  if (String(json.status) !== "1") {
    throw new Error(`Sankhya erro: ${json.statusMessage}`);
  }

  const body = json.responseBody;
  if (!body || !body.rows) return {};

  const colIndex: ColIndex = {};
  body.fieldsMetadata.forEach((meta, i) => {
    colIndex[meta.name.toUpperCase()] = i;
  });

  const resultadoFinal: ResultadoAgrupado = {};

  for (const row of body.rows) {
    const pedido = getLong(row, colIndex, "NUMPEDIDO");
    const op = getLong(row, colIndex, "IDIPROC");

    if (pedido === null || op === null) continue;

    const cPed = String(pedido);
    const cOp = String(op);

    // Inicializa níveis do objeto
    resultadoFinal[cPed] ??= {};
    resultadoFinal[cPed][cOp] ??= {
      numeroPedido: pedido,
      numeroOp: op,
      situacaoGeral: getString(row, colIndex, "SITUACAO_GERAL"),
      produtos: [],
      atividades: [],
    };

    const currentOp = resultadoFinal[cPed][cOp];

    // Adiciona Atividade se não existir
    const idAtiv = getString(row, colIndex, "IDIATV");
    if (idAtiv !== "" && !currentOp.atividades.some(a => a.id === idAtiv)) {
      currentOp.atividades.push({
        id: idAtiv,
        situacao: getString(row, colIndex, "SITUACAO_ATIV"),
        dhAceite: getString(row, colIndex, "DHACEITE"),
        dhInicio: getString(row, colIndex, "DHINICIO"),
        temQualidade: getLong(row, colIndex, "IDEFX") !== null,
      });
    }

    // Adiciona Produto se não existir
    const codProd = getLong(row, colIndex, "CODPROD");
    if (codProd !== null && !currentOp.produtos.some(p => p.codigo === codProd)) {
      currentOp.produtos.push({
        codigo: codProd,
        descricao: getString(row, colIndex, "DESCRPROD"),
        referencia: getString(row, colIndex, "REFERENCIA"),
      });
    }
  }

  return resultadoFinal;
}

// --- Handler HTTP ---

Deno.serve(async (_req: Request) => {
  try {
    const dadosPorPedido = await buscarProcessosPorPedido();

    let totalOps = 0, aguardando = 0, emAndamento = 0, finalizadas = 0;

    for (const pedidoOps of Object.values(dadosPorPedido)) {
      for (const op of Object.values(pedidoOps)) {
        totalOps++;
        if (op.atividades.some(a => a.situacao === "Aguardando aceite")) aguardando++;
        else if (op.atividades.some(a => a.situacao === "Em andamento")) emAndamento++;
        
        if (op.situacaoGeral === "C") finalizadas++;
      }
    }

    return Response.json({
      estatisticas: { totalOps, aguardando, emAndamento, finalizadas },
      pedidos: dadosPorPedido
    });

  } catch (error: any) {
    return Response.json(
      { erro: error.message || "Erro interno no servidor" }, 
      { status: 500 }
    );
  }
});