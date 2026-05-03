import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MARGIN_MS = 60_000;
let _cachedToken = null;
let _expiresAt = 0;

async function getValidToken() {
  if (_cachedToken && Date.now() < _expiresAt - MARGIN_MS) return _cachedToken;
  const oauthUrl = Deno.env.get("SANKHYA_OAUTH_URL");
  const clientId = Deno.env.get("SANKHYA_CLIENT_ID");
  const clientSecret = Deno.env.get("SANKHYA_CLIENT_SECRET");
  const xToken = Deno.env.get("SANKHYA_X_TOKEN");
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

/**
 * Backfill: preenche order_number e order_id em ProductionOrders que
 * têm idiproc mas estão sem order_number.
 * Faz query direta ao Sankhya para mapear IDIPROC → NUMPEDIDO.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Busca registros sem order_number
    const allRecords = await base44.asServiceRole.entities.ProductionOrder.list("-created_date", 9999);
    const toFix = allRecords.filter(r => r.idiproc && (!r.order_number || r.order_number === ""));

    console.log(`[backfill] Total: ${allRecords.length} | Sem order_number: ${toFix.length}`);

    if (toFix.length === 0) {
      return Response.json({ success: true, fixed: 0, message: "Nenhum registro precisava de backfill" });
    }

    // 2. Query Sankhya: IDIPROC → NUMPEDIDO (apenas dos IDs que precisamos)
    const idiprocList = toFix.map(r => r.idiproc).join(",");
    const sql = `SELECT TOP 5000 P.IDIPROC, COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO
FROM TPRIPROC P
LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = P.NUNOTA
WHERE P.IDIPROC IN (${idiprocList})`;

    const token = await getValidToken();
    const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
    const urlSankhya = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

    const sankhyaRes = await fetch(urlSankhya, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ serviceName: "DbExplorerSP.executeQuery", requestBody: { sql } }),
    });
    const sankhyaData = await sankhyaRes.json();

    if (String(sankhyaData.status) !== "1") {
      throw new Error(`Erro Sankhya: ${sankhyaData.statusMessage}`);
    }

    // Constrói mapa idiproc → numpedido
    const meta = sankhyaData.responseBody?.fieldsMetadata || [];
    const rows = sankhyaData.responseBody?.rows || [];
    const idx = {};
    meta.forEach((m, i) => { idx[m.name.toUpperCase()] = i; });

    const idiprocToNumpedido = {};
    for (const row of rows) {
      const idiproc = String(row[idx["IDIPROC"]] ?? "").trim();
      const numpedido = String(row[idx["NUMPEDIDO"]] ?? "").trim();
      if (idiproc && numpedido) idiprocToNumpedido[idiproc] = numpedido;
    }

    console.log(`[backfill] Mapeamento obtido: ${Object.keys(idiprocToNumpedido).length} entradas`);

    // 3. Atualiza registros
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let fixed = 0, notFound = 0, errors = 0;

    for (let i = 0; i < toFix.length; i++) {
      const rec = toFix[i];
      const numpedido = idiprocToNumpedido[String(rec.idiproc)];

      if (!numpedido) {
        notFound++;
        continue;
      }

      try {
        await base44.asServiceRole.entities.ProductionOrder.update(rec.id, {
          order_number: numpedido,
          order_id:     numpedido,
        });
        fixed++;
      } catch (err) {
        if (err.message?.includes("Rate limit")) {
          await sleep(3000);
          i--;
          continue;
        }
        console.error(`[backfill] Erro OP ${rec.idiproc}: ${err.message}`);
        errors++;
      }

      await sleep(200);
    }

    console.log(`[backfill] Concluído: ${fixed} corrigidos, ${notFound} não encontrados, ${errors} erros`);

    return Response.json({ success: true, fixed, notFound, errors, total: toFix.length });

  } catch (error) {
    console.error("[backfill] Erro fatal:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});