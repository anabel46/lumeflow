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
  const makeHeaders = (t) => ({ ...(options.headers || {}), "Authorization": `Bearer ${t}`, "Content-Type": "application/json" });
  let res = await fetch(url, { ...options, headers: makeHeaders(token) });
  if (res.status === 401) { _cachedToken = null; res = await fetch(url, { ...options, headers: makeHeaders(await refreshToken()) }); }
  return res;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLong(row, idx, col) {
  const v = row[idx[col.toUpperCase()]];
  if (v == null || v === "") return null;
  const cleaned = String(v).trim().replace(/\D/g, "");
  return cleaned === "" ? null : (isNaN(Number(cleaned)) ? null : Number(cleaned));
}
function getString(row, idx, col) {
  const v = row[idx[col.toUpperCase()]];
  return (v == null) ? "" : String(v).trim();
}

// ── Status mapping ────────────────────────────────────────────────────────────
function mapearStatus(situacao) {
  const mapa = { "A": "em_producao", "P": "planejamento", "F": "finalizado" };
  return mapa[situacao] || "planejamento";
}

// ── SQL ───────────────────────────────────────────────────────────────────────
const SQL_OPS = `
SELECT
    COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO,
    P.IDIPROC,
    P.STATUSPROC AS SITUACAO_GERAL,
    MIN(ITE.CODPROD) AS CODPROD,
    MIN(PRO.DESCRPROD) AS DESCRPROD,
    MIN(PRO.REFERENCIA) AS REFERENCIA
FROM TPRIPROC P
LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = P.NUNOTA
LEFT JOIN TGFITE ITE ON ITE.NUNOTA = P.NUNOTA
LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
WHERE P.STATUSPROC IN ('A', 'P', 'F')
  AND P.IDIPROC >= (SELECT MAX(IDIPROC) - 3000 FROM TPRIPROC)
GROUP BY P.IDIPROC, P.STATUSPROC, CAB.NUMPEDIDO, P.NUNOTA
ORDER BY P.IDIPROC ASC`;

// ── Main Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
    if (!baseUrl) throw new Error("SANKHYA_BASE_URL não configurada");

    const url = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

    const res = await fetchSankhya(url, {
      method: "POST",
      body: JSON.stringify({ serviceName: "DbExplorerSP.executeQuery", requestBody: { sql: SQL_OPS } }),
    });

    const json = await res.json();
    if (String(json.status) !== "1") throw new Error(`Sankhya erro: ${json.statusMessage}`);

    const rows = json.responseBody?.rows || [];
    const meta = json.responseBody?.fieldsMetadata || [];
    const idx = {};
    meta.forEach((m, i) => { idx[m.name.toUpperCase()] = i; });

    // Flatten OPs from Sankhya
    const opsSankhya = [];
    for (const row of rows) {
      const idiproc = getLong(row, idx, "IDIPROC");
      if (!idiproc) continue;
      opsSankhya.push({
        idiproc: String(idiproc),
        numpedido: String(getLong(row, idx, "NUMPEDIDO") || ""),
        situacao: getString(row, idx, "SITUACAO_GERAL"),
        descrprod: getString(row, idx, "DESCRPROD"),
        referencia: getString(row, idx, "REFERENCIA"),
      });
    }

    console.log(`📦 OPs Sankhya: ${opsSankhya.length}`);

    // Busca registros existentes
    const existingRecords = await base44.asServiceRole.entities.ProductionOrder.list("-created_date", 9999);
    const existingByIdiproc = {};
    for (const rec of existingRecords) {
      const key = rec.idiproc || rec.unique_number;
      if (key) {
        if (!existingByIdiproc[key]) existingByIdiproc[key] = [];
        existingByIdiproc[key].push(rec);
      }
    }

    let inserted = 0, updated = 0, errors = 0;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    for (let i = 0; i < opsSankhya.length; i++) {
      const op = opsSankhya[i];
      try {
        const existing = existingByIdiproc[op.idiproc] || [];
        const record = existing[0] || null;
        const status = mapearStatus(op.situacao);

        if (record) {
          await base44.asServiceRole.entities.ProductionOrder.update(record.id, {
            status,
            order_number: op.numpedido || record.order_number,
            order_id: op.numpedido || record.order_id,
            product_name: op.descrprod || record.product_name,
            reference: op.referencia || record.reference,
          });
          for (let d = 1; d < existing.length; d++) {
            await base44.asServiceRole.entities.ProductionOrder.delete(existing[d].id).catch(() => {});
          }
          updated++;
        } else {
          await base44.asServiceRole.entities.ProductionOrder.create({
            idiproc: op.idiproc,
            unique_number: op.idiproc,
            order_number: op.numpedido,
            order_id: op.numpedido,
            product_name: op.descrprod || "—",
            reference: op.referencia || "",
            quantity: 1,
            status,
          });
          inserted++;
        }
      } catch (err) {
        if (err.message?.includes("Rate limit")) {
          await sleep(2000);
          i--;
          continue;
        }
        console.error(`❌ Erro OP ${op.idiproc}:`, err.message);
        errors++;
      }
      await sleep(300);
    }

    console.log(`✅ Sync: ${inserted} inseridas, ${updated} atualizadas, ${errors} erros`);

    return Response.json({
      success: true,
      message: `Sincronização concluída: ${inserted} inseridas, ${updated} atualizadas`,
      inserted,
      updated,
      errors,
      total: opsSankhya.length,
    });

  } catch (error) {
    console.error("❌ Erro na sincronização:", error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});