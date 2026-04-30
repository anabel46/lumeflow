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
  const oauthUrl = Deno.env.get("SANKHYA_OAUTH_URL");
  const clientId = Deno.env.get("SANKHYA_CLIENT_ID");
  const clientSecret = Deno.env.get("SANKHYA_CLIENT_SECRET");
  const xToken = Deno.env.get("SANKHYA_X_TOKEN");
  if (!oauthUrl || !clientId || !clientSecret || !xToken)
    throw new Error("Variáveis Sankhya ausentes");

  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(oauthUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Token": xToken },
      body: body.toString(),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Auth Sankhya falhou: ${await res.text()}`);
    const data = await res.json();
    _cachedToken = data.access_token;
    _expiresAt = Date.now() + data.expires_in * 1000;
    return _cachedToken;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Timeout no auth Sankhya (15s)");
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchSankhya(url, options = {}, timeoutMs = 30_000) {
  const token = await getValidToken();
  const makeHeaders = (t) => ({
    ...(options.headers || {}),
    "Authorization": `Bearer ${t}`,
    "Content-Type": "application/json",
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, { ...options, headers: makeHeaders(token), signal: controller.signal });
    if (res.status === 401) {
      _cachedToken = null;
      res = await fetch(url, { ...options, headers: makeHeaders(await refreshToken()), signal: controller.signal });
    }
    return res;
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`Timeout na chamada Sankhya (${timeoutMs / 1000}s)`);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getLong(row, idx, col) {
  const v = row[idx[col.toUpperCase()]];
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? null : n;
}
function getString(row, idx, col) {
  const v = row[idx[col.toUpperCase()]];
  return v !== undefined && v !== null ? String(v).trim() : "";
}
function buildIdx(meta) {
  const idx = {};
  meta.forEach((m, i) => { idx[m.name.toUpperCase()] = i; });
  return idx;
}

const SETOR_MAP = {
  "ESTAMPARIA": "estamparia",
  "TORNEARIA": "tornearia",
  "CORTE": "corte",
  "SOLDA": "solda",
  "LIXA": "lixa",
  "REPUXO": "repuxo",
  "PINTURA": "pintura",
  "MONTAGEM DECORATIVA": "montagem_decorativa",
  "MONTAGEM ELETRICA": "montagem_eletrica",
  "MONTAGEM ELÉTRICA": "montagem_eletrica",
  "MONTAGEM PERFIL": "montagem_perfil",
  "MONTAGEM EMBUTIDOS": "montagem_embutidos",
  "CONTROLE QUALIDADE": "controle_qualidade",
  "CONTROLE DE QUALIDADE": "controle_qualidade",
  "EMBALAGEM": "embalagem",
};

function mapStatus(situacao) {
  const mapa = { "A": "em_producao", "P": "planejamento", "F": "finalizado" };
  return mapa[situacao] || "planejamento";
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Main Handler ──────────────────────────────────────────────────────────────
// Parâmetros opcionais: { offset: number, batch_size: number }
// Retorna: { done, next_offset, inserted, updated, errors, total }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const offset = body.offset ?? 0;
    const batchSize = body.batch_size ?? 80;

    const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
    const urlSankhya = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;
    const callSankhya = (sql) =>
      fetchSankhya(urlSankhya, {
        method: "POST",
        body: JSON.stringify({ serviceName: "DbExplorerSP.executeQuery", requestBody: { sql } }),
      }, 25_000).then(r => r.json());

    // Busca OPs ativas/planejamento recentes
    const SQL_OPS = `
SELECT
    COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO,
    P.IDIPROC,
    P.STATUSPROC AS SITUACAO_GERAL,
    ITE.CODPROD,
    PRO.DESCRPROD,
    PRO.REFERENCIA
FROM TPRIPROC P
LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = P.NUNOTA
LEFT JOIN (
    SELECT NUNOTA, MIN(CODPROD) AS CODPROD
    FROM TGFITE
    GROUP BY NUNOTA
) ITE ON ITE.NUNOTA = P.NUNOTA
LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
WHERE P.STATUSPROC IN ('A', 'P')
  AND P.IDIPROC >= (SELECT MAX(IDIPROC) - 3000 FROM TPRIPROC)
ORDER BY P.IDIPROC DESC`;

    const SQL_FLUXO = `
SELECT DISTINCT
    P.IDIPROC,
    A.IDEFX,
    A.IDIATV,
    FX.DESCRICAO AS DESCRICAO_FX,
    CASE
        WHEN A.DHFINAL  IS NOT NULL AND A.DHFINAL  <> '' THEN 'F'
        WHEN A.DHINICIO IS NOT NULL AND A.DHINICIO <> '' THEN 'A'
        ELSE 'P'
    END AS SITUACAO_ATIVIDADE
FROM TPRIPROC P
INNER JOIN TPRIATV A  ON A.IDIPROC = P.IDIPROC
LEFT  JOIN TPREFX  FX ON FX.IDEFX  = A.IDEFX
WHERE A.IDEFX IS NOT NULL
  AND P.STATUSPROC IN ('A', 'P')
  AND P.IDIPROC >= (SELECT MAX(IDIPROC) - 3000 FROM TPRIPROC)
ORDER BY P.IDIPROC, A.IDIATV`;

    console.log(`🔄 Buscando dados Sankhya (offset=${offset})...`);
    const [opsRaw, fluxoRaw] = await Promise.all([
      callSankhya(SQL_OPS),
      callSankhya(SQL_FLUXO),
    ]);

    if (String(opsRaw.status) !== "1") throw new Error(`Erro OPs: ${opsRaw.statusMessage}`);
    if (String(fluxoRaw.status) !== "1") throw new Error(`Erro Fluxo: ${fluxoRaw.statusMessage}`);

    // Processa fluxo
    const fluxoPorOp = {};
    if (fluxoRaw.responseBody?.rows) {
      const idx = buildIdx(fluxoRaw.responseBody.fieldsMetadata);
      for (const row of fluxoRaw.responseBody.rows) {
        const idiproc = String(getLong(row, idx, "IDIPROC") || "");
        const idefx   = getString(row, idx, "IDEFX");
        const idiatv  = getLong(row, idx, "IDIATV") || 0;
        const descFx  = getString(row, idx, "DESCRICAO_FX").toUpperCase();
        if (!idiproc || !idefx) continue;
        if (!fluxoPorOp[idiproc]) fluxoPorOp[idiproc] = [];
        if (!fluxoPorOp[idiproc].some(f => f.idefx === idefx)) {
          const statusAtv = getString(row, idx, "SITUACAO_ATIVIDADE").toUpperCase();
          const situacaoAtividade = statusAtv === "F" ? "Finalizada"
            : statusAtv === "A" ? "Em andamento"
            : "Aguardando";
          fluxoPorOp[idiproc].push({
            idefx, idiatv,
            descricao: getString(row, idx, "DESCRICAO_FX"),
            setor: SETOR_MAP[descFx] || null,
            situacao_atividade: situacaoAtividade,
          });
        }
      }
      Object.values(fluxoPorOp).forEach(arr => arr.sort((a, b) => a.idiatv - b.idiatv));
    }

    // Monta lista completa de OPs
    const opsIdx = buildIdx(opsRaw.responseBody.fieldsMetadata);
    const allOps = [];
    for (const row of opsRaw.responseBody.rows) {
      const idiproc = getLong(row, opsIdx, "IDIPROC");
      if (!idiproc) continue;
      const idiprocStr = String(idiproc);
      const fluxo = fluxoPorOp[idiprocStr] || [];
      const production_sequence = fluxo.filter(f => f.setor).map(f => f.setor).filter((v, i, arr) => arr.indexOf(v) === i);
      allOps.push({
        idiproc: idiprocStr,
        numpedido: String(getLong(row, opsIdx, "NUMPEDIDO") || ""),
        descrprod: getString(row, opsIdx, "DESCRPROD"),
        referencia: getString(row, opsIdx, "REFERENCIA"),
        status: mapStatus(getString(row, opsIdx, "SITUACAO_GERAL")),
        production_sequence,
        fluxo_detalhado: fluxo,
      });
    }

    const total = allOps.length;
    const batch = allOps.slice(offset, offset + batchSize);
    console.log(`📦 Total OPs: ${total} | Processando ${offset}–${offset + batch.length}`);

    // Busca existentes apenas para o lote atual
    const existingRecords = await base44.asServiceRole.entities.ProductionOrder.list("-created_date", 9999);
    const existingByIdiproc = {};
    for (const rec of existingRecords) {
      const key = rec.idiproc || rec.unique_number;
      existingByIdiproc[key] = rec;
    }

    let inserted = 0, updated = 0, errors = 0;

    for (const op of batch) {
      try {
        const record = existingByIdiproc[op.idiproc] || null;
        const payload = {
          idiproc:             op.idiproc,
          unique_number:       op.idiproc,
          order_number:        op.numpedido,
          order_id:            op.numpedido,
          product_name:        op.descrprod || "—",
          reference:           op.referencia || "",
          status:              op.status,
          production_sequence: op.production_sequence,
          sankhya_fluxo:       op.fluxo_detalhado,
        };

        if (record) {
          await base44.asServiceRole.entities.ProductionOrder.update(record.id, {
            status:              payload.status,
            product_name:        payload.product_name,
            reference:           payload.reference,
            production_sequence: payload.production_sequence,
            sankhya_fluxo:       payload.sankhya_fluxo,
          });
          updated++;
        } else {
          await base44.asServiceRole.entities.ProductionOrder.create({ ...payload, quantity: 1 });
          inserted++;
        }
        await sleep(150);
      } catch (err) {
        if (err.message?.includes("Rate limit")) {
          await sleep(3000);
          // Tenta novamente
          try {
            const record = existingByIdiproc[op.idiproc] || null;
            if (record) {
              await base44.asServiceRole.entities.ProductionOrder.update(record.id, {
                status: op.status, product_name: op.descrprod || "—",
                reference: op.referencia || "", sankhya_fluxo: op.fluxo_detalhado,
              });
              updated++;
            } else {
              await base44.asServiceRole.entities.ProductionOrder.create({
                idiproc: op.idiproc, unique_number: op.idiproc,
                order_number: op.numpedido, order_id: op.numpedido,
                product_name: op.descrprod || "—", reference: op.referencia || "",
                status: op.status, production_sequence: op.production_sequence,
                sankhya_fluxo: op.fluxo_detalhado, quantity: 1,
              });
              inserted++;
            }
          } catch {
            errors++;
          }
        } else {
          console.error(`❌ Erro OP ${op.idiproc}:`, err.message);
          errors++;
        }
      }
    }

    const done = offset + batch.length >= total;
    const next_offset = done ? null : offset + batch.length;

    console.log(`✅ Lote concluído: ${inserted} inseridas, ${updated} atualizadas, ${errors} erros | done=${done}`);

    return Response.json({
      success: true,
      done,
      next_offset,
      inserted,
      updated,
      errors,
      total,
      processed: offset + batch.length,
    });

  } catch (error) {
    console.error("❌ Erro sankhyaSyncBatch:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});