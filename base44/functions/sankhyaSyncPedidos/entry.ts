import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Token Manager ──────────────────────────────────────────────────────────────
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
  const timeoutId = setTimeout(() => controller.abort(), 20_000);
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
    if (err.name === "AbortError") throw new Error("Timeout no auth Sankhya (20s)");
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Timeout aumentado para 45s para tolerar lentidão do Sankhya
async function fetchSankhya(url, options = {}, timeoutMs = 45_000) {
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
    if (err.name === "AbortError") throw new Error(`Timeout na chamada Sankhya (${timeoutMs / 1000}s) — API demorou demais para responder`);
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

// Converte "ddmmyyyy hh:mm:ss" → Date
function parseSankhyaDate(str) {
  if (!str || str.length < 8) return null;
  const clean = str.trim();
  const day = clean.substring(0, 2);
  const mon = clean.substring(2, 4);
  const yr  = clean.substring(4, 8);
  const time = clean.substring(9) || "00:00:00";
  const iso = `${yr}-${mon}-${day}T${time}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// Mapeia situacaoGeral da OP → status do pedido (Order)
function mapOrderStatus(situacaoGeral, hasEmExecucao) {
  if (situacaoGeral === "F") return "finalizado";
  if (situacaoGeral === "A" || hasEmExecucao) return "em_producao";
  return "confirmado";
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── SQL limitado: apenas últimos 30 dias + máx 200 OPs recentes ──────────────
// Isso evita timeout por volume excessivo de dados
const SQL_PEDIDOS = `
SELECT
    COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO,
    P.STATUSPROC AS SITUACAO_GERAL,
    MIN(A.DHINCLUSAO) AS PRIMEIRA_DHINCLUSAO,
    MIN(PRO.REFERENCIA) AS REFERENCIA,
    MIN(PRO.DESCRPROD) AS DESCRPROD,
    MAX(CASE WHEN A.DHINICIO IS NOT NULL AND A.DHFINAL IS NULL THEN 1 ELSE 0 END) AS TEM_EM_EXECUCAO
FROM TPRIPROC P
LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = P.NUNOTA
LEFT JOIN TPRIATV A ON A.IDIPROC = P.IDIPROC
LEFT JOIN (
    SELECT NUNOTA, MIN(CODPROD) AS CODPROD FROM TGFITE GROUP BY NUNOTA
) ITE ON ITE.NUNOTA = P.NUNOTA
LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
WHERE P.STATUSPROC IN ('A', 'P', 'F')
  AND P.IDIPROC >= (SELECT MAX(IDIPROC) - 500 FROM TPRIPROC)
GROUP BY COALESCE(CAB.NUMPEDIDO, P.NUNOTA), P.STATUSPROC
ORDER BY NUMPEDIDO DESC`;

Deno.serve(async (req) => {
  const startTs = Date.now();
  const startLog = new Date(startTs).toISOString();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
    const urlSankhya = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

    // ── DIAGNÓSTICO: log de início ────────────────────────────────────────────
    console.log(`[${startLog}] 🚀 sankhyaSyncPedidos iniciado`);
    console.log(`[${startLog}] 🌐 URL Sankhya: ${urlSankhya}`);

    const t1 = Date.now();
    console.log(`[${new Date(t1).toISOString()}] 📡 Iniciando chamada SQL ao Sankhya...`);

    let raw;
    try {
      raw = await fetchSankhya(urlSankhya, {
        method: "POST",
        body: JSON.stringify({ serviceName: "DbExplorerSP.executeQuery", requestBody: { sql: SQL_PEDIDOS } }),
      }, 45_000).then(r => r.json());
    } catch (fetchErr) {
      const elapsed = ((Date.now() - t1) / 1000).toFixed(1);
      console.error(`[${new Date().toISOString()}] ❌ Falha na chamada Sankhya após ${elapsed}s: ${fetchErr.message}`);
      return Response.json({
        error: `Timeout na API Sankhya após ${elapsed}s. Tente novamente em instantes.`,
        detail: fetchErr.message,
      }, { status: 504 });
    }

    const t2 = Date.now();
    console.log(`[${new Date(t2).toISOString()}] ✅ Resposta Sankhya recebida em ${((t2 - t1) / 1000).toFixed(1)}s`);

    if (String(raw.status) !== "1") {
      throw new Error(`Sankhya retornou erro: ${raw.statusMessage}`);
    }

    const rows = raw.responseBody?.rows || [];
    const meta = raw.responseBody?.fieldsMetadata || [];
    const idx = buildIdx(meta);
    console.log(`[${new Date().toISOString()}] 📊 Linhas brutas recebidas: ${rows.length}`);

    // ── Agrupa por numeroPedido (prioriza status mais ativo) ──────────────────
    const pedidosMap = {};
    for (const row of rows) {
      const numPedido = String(getLong(row, idx, "NUMPEDIDO") || "");
      if (!numPedido) continue;

      const situacao = getString(row, idx, "SITUACAO_GERAL");
      const dhRaw = getString(row, idx, "PRIMEIRA_DHINCLUSAO");
      const temEmExecucao = getLong(row, idx, "TEM_EM_EXECUCAO") === 1;
      const referencia = getString(row, idx, "REFERENCIA");
      const descrprod = getString(row, idx, "DESCRPROD");

      if (pedidosMap[numPedido]) {
        const ex = pedidosMap[numPedido];
        const prioridade = { A: 3, P: 2, F: 1 };
        if ((prioridade[situacao] || 0) > (prioridade[ex.situacao] || 0)) {
          ex.situacao = situacao;
        }
        ex.temEmExecucao = ex.temEmExecucao || temEmExecucao;
        if (!ex.dhRaw && dhRaw) ex.dhRaw = dhRaw;
      } else {
        pedidosMap[numPedido] = { numPedido, situacao, dhRaw, temEmExecucao, referencia, descrprod };
      }
    }

    const pedidosList = Object.values(pedidosMap);
    console.log(`[${new Date().toISOString()}] 📦 Pedidos únicos a processar: ${pedidosList.length}`);

    // ── Busca existentes na entidade Order ────────────────────────────────────
    const existingOrders = await base44.asServiceRole.entities.Order.list("-created_date", 9999);
    const existingByNumber = {};
    for (const o of existingOrders) {
      existingByNumber[o.order_number] = o;
    }

    let inserted = 0, updated = 0, errors = 0;

    // ── Processa em lotes de 10 para não sobrecarregar ────────────────────────
    const BATCH_SIZE = 10;
    for (let i = 0; i < pedidosList.length; i += BATCH_SIZE) {
      const batch = pedidosList.slice(i, i + BATCH_SIZE);
      console.log(`[${new Date().toISOString()}] 🔧 Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pedidosList.length / BATCH_SIZE)} (${batch.length} pedidos)`);

      for (const p of batch) {
        try {
          const requestDate = parseSankhyaDate(p.dhRaw);
          const deliveryDeadline = requestDate
            ? new Date(requestDate.getTime() + 20 * 24 * 60 * 60 * 1000)
            : null;

          const orderStatus = mapOrderStatus(p.situacao, p.temEmExecucao);
          const obs = [p.referencia, p.descrprod].filter(Boolean).join(" - ") || null;
          const existing = existingByNumber[p.numPedido];

          if (existing) {
            const updatePayload = {
              status: orderStatus,
              sankhya_id: p.numPedido,
            };
            if (requestDate && !existing.request_date) {
              updatePayload.request_date = requestDate.toISOString().split("T")[0];
            }
            if (deliveryDeadline && !existing.delivery_deadline) {
              updatePayload.delivery_deadline = deliveryDeadline.toISOString().split("T")[0];
            }
            if (!existing.observations && obs) {
              updatePayload.observations = obs;
            }
            await base44.asServiceRole.entities.Order.update(existing.id, updatePayload);
            updated++;
          } else {
            await base44.asServiceRole.entities.Order.create({
              order_number: p.numPedido,
              client_name: "FÁBRICA",
              request_date: requestDate ? requestDate.toISOString().split("T")[0] : null,
              delivery_deadline: deliveryDeadline ? deliveryDeadline.toISOString().split("T")[0] : null,
              delivery_type: "normal",
              status: orderStatus,
              observations: obs,
              sankhya_id: p.numPedido,
            });
            inserted++;
          }
        } catch (err) {
          if (err.message?.includes("Rate limit")) {
            console.warn(`[${new Date().toISOString()}] ⚠️ Rate limit — aguardando 3s...`);
            await sleep(3000);
          }
          console.error(`[${new Date().toISOString()}] ❌ Erro pedido ${p.numPedido}: ${err.message}`);
          errors++;
        }
      }

      // Pausa entre lotes para não sobrecarregar a API
      if (i + BATCH_SIZE < pedidosList.length) {
        await sleep(300);
      }
    }

    const totalMs = Date.now() - startTs;
    console.log(`[${new Date().toISOString()}] ✅ Concluído em ${(totalMs / 1000).toFixed(1)}s — ${inserted} inseridos, ${updated} atualizados, ${errors} erros`);

    return Response.json({
      success: true,
      inserted,
      updated,
      errors,
      total: pedidosList.length,
      elapsed_seconds: (totalMs / 1000).toFixed(1),
    });

  } catch (error) {
    const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);
    console.error(`[${new Date().toISOString()}] ❌ Erro fatal após ${elapsed}s: ${error.message}`);
    return Response.json({
      error: error.message,
      elapsed_seconds: elapsed,
    }, { status: 500 });
  }
});