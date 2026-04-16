// _shared/sankhyaQuery.ts
import { fetchSankhya } from "./tokenManager.ts";

export interface OpDTO {
  numeroPedido:  number;
  numeroOp:      number;
  situacaoGeral: string;
  produtos: Array<{
    codigo:     number;
    descricao:  string;
    referencia: string;
  }>;
  atividades: Array<{
    id:           string;
    situacao:     string;
    dhAceite:     string;
    dhInicio:     string;
    temQualidade: boolean;
  }>;
}

const SQL_OPERACOES = `SELECT
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
ORDER BY NUMPEDIDO DESC, P.IDIPROC, A.IDIATV`;

export async function buscarProcessosPorPedido(): Promise<Record<string, Record<string, OpDTO>>> {
  const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
  if (!baseUrl) throw new Error("SANKHYA_BASE_URL nao configurada no .env");

  // URL CORRETA — a unica que funciona com DbExplorerSP
  const url = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

  console.log("Buscando dados do Sankhya:", url);

  const res = await fetchSankhya(url, {
    method: "POST",
    body: JSON.stringify({
      serviceName: "DbExplorerSP.executeQuery",
      requestBody: { sql: SQL_OPERACOES },
    }),
  });

  const json = await res.json() as Record<string, unknown>;
  console.log("Status Sankhya:", json.status);

  if (String(json.status) !== "1") {
    throw new Error(`Sankhya erro: ${json.statusMessage}`);
  }

  return converterParaMap(json);
}

function converterParaMap(json: Record<string, unknown>): Record<string, Record<string, OpDTO>> {
  const body = json.responseBody as Record<string, unknown>;

  if (!body || !body.rows) {
    console.warn("Sankhya retornou sem rows:", JSON.stringify(json).substring(0, 200));
    return {};
  }

  const rows = body.rows as unknown[][];
  const meta = body.fieldsMetadata as Array<{ name: string; order: number }>;

  const colIndex: Record<string, number> = {};
  for (let i = 0; i < meta.length; i++) {
    colIndex[meta[i].name.toUpperCase()] = i;
  }

  const resultadoFinal: Record<string, Record<string, OpDTO>> = {};

  for (const row of rows) {
    const pedido = getLong(row, colIndex, "NUMPEDIDO");
    const op     = getLong(row, colIndex, "IDIPROC");
    if (pedido == null || op == null) continue;

    const cPed = String(pedido);
    const cOp  = String(op);

    if (!resultadoFinal[cPed]) resultadoFinal[cPed] = {};

    if (!resultadoFinal[cPed][cOp]) {
      resultadoFinal[cPed][cOp] = {
        numeroPedido:  pedido,
        numeroOp:      op,
        situacaoGeral: getString(row, colIndex, "SITUACAO_GERAL"),
        produtos:      [],
        atividades:    [],
      };
    }

    const opMap = resultadoFinal[cPed][cOp];

    const idAtiv = getString(row, colIndex, "IDIATV");
    if (idAtiv !== "" && !opMap.atividades.some((a) => a.id === idAtiv)) {
      opMap.atividades.push({
        id:           idAtiv,
        situacao:     getString(row, colIndex, "SITUACAO_ATIV"),
        dhAceite:     getString(row, colIndex, "DHACEITE"),
        dhInicio:     getString(row, colIndex, "DHINICIO"),
        temQualidade: getLong(row, colIndex, "IDEFX") != null,
      });
    }

    const codProd = getLong(row, colIndex, "CODPROD");
    if (codProd != null && !opMap.produtos.some((p) => p.codigo === codProd)) {
      opMap.produtos.push({
        codigo:     codProd,
        descricao:  getString(row, colIndex, "DESCRPROD"),
        referencia: getString(row, colIndex, "REFERENCIA"),
      });
    }
  }

  console.log("Pedidos encontrados:", Object.keys(resultadoFinal).length);
  return resultadoFinal;
}

function getNode(row: unknown[], idx: Record<string, number>, col: string): unknown {
  const i = idx[col.toUpperCase()];
  return (i !== undefined && i < row.length) ? row[i] : null;
}

function getLong(row: unknown[], idx: Record<string, number>, col: string): number | null {
  const v = getNode(row, idx, col);
  if (v == null || v === "") return null;
  const cleaned = String(v).trim().replace(/\D/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

function getString(row: unknown[], idx: Record<string, number>, col: string): string {
  const v = getNode(row, idx, col);
  return (v == null) ? "" : String(v).trim();
}