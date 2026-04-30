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
    if (err.name === "AbortError") throw new Error(`Timeout na chamada Sankhya (${timeoutMs / 1000}s)`);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
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

// Determina o status do pedido com base no conjunto de OPs
// "em_producao" se qualquer OP for A ou P; "finalizado" só se TODAS forem F
function mapOrderStatusFromOps(ops) {
  const hasAtivo = ops.some(op => op.situacaoGeral === "A" || op.situacaoGeral === "P");
  if (hasAtivo) return "em_producao";
  return "finalizado";
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Main Handler ───────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const startTs = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    console.log(`[${new Date().toISOString()}] 🚀 sankhyaSyncPedidos iniciado`);

    // ── PASSO 1: Chamar getDashboard internamente ─────────────────────────────
    const t1 = Date.now();
    console.log(`[${new Date(t1).toISOString()}] 📡 Chamando getDashboard...`);

    let dashboardData;
    try {
      const dashRes = await base44.functions.invoke("getDashboard", {});
      dashboardData = dashRes.data ?? dashRes;
    } catch (fetchErr) {
      const elapsed = ((Date.now() - t1) / 1000).toFixed(1);
      console.error(`[${new Date().toISOString()}] ❌ Falha ao chamar getDashboard após ${elapsed}s: ${fetchErr.message}`);
      return Response.json({
        error: `Falha ao obter dados de produção: ${fetchErr.message}`,
      }, { status: 502 });
    }

    const t2 = Date.now();
    console.log(`[${new Date(t2).toISOString()}] ✅ getDashboard respondeu em ${((t2 - t1) / 1000).toFixed(1)}s`);

    const pedidosRaw = dashboardData?.pedidos;
    if (!pedidosRaw || typeof pedidosRaw !== "object") {
      throw new Error("Resposta de getDashboard não contém 'pedidos'");
    }

    // ── PASSO 2: Transformar dados em lista de pedidos ────────────────────────
    const pedidosList = [];

    for (const [numPedido, opsMap] of Object.entries(pedidosRaw)) {
      const ops = Object.values(opsMap);
      if (ops.length === 0) continue;

      // Status mais crítico entre todas as OPs
      const orderStatus = mapOrderStatusFromOps(ops);

      // Primeira OP com produto
      const opComProduto = ops.find(op => op.produtos?.length > 0) || ops[0];
      const produto = opComProduto?.produtos?.[0] || null;

      // dhInclusao da primeira atividade da primeira OP
      const primeiraOp = ops[0];
      const dhRaw = primeiraOp?.atividades?.[0]?.dhInclusao || null;
      const requestDate = parseSankhyaDate(dhRaw);
      const deliveryDeadline = requestDate
        ? new Date(requestDate.getTime() + 20 * 24 * 60 * 60 * 1000)
        : null;

      const obs = produto
        ? [produto.referencia, produto.descricao].filter(Boolean).join(" - ") || null
        : null;

      pedidosList.push({
        numPedido: String(numPedido),
        orderStatus,
        requestDate,
        deliveryDeadline,
        obs,
      });
    }

    console.log(`[${new Date().toISOString()}] 📦 Pedidos únicos a processar: ${pedidosList.length}`);

    // ── Busca existentes na entidade Order ────────────────────────────────────
    const existingOrders = await base44.asServiceRole.entities.Order.list("-created_date", 9999);
    const existingByNumber = {};
    for (const o of existingOrders) {
      existingByNumber[o.order_number] = o;
    }

    // ── Set com todos os numeroPedido vindos da API nesta sync ────────────────
    const apiPedidoNumbers = new Set(pedidosList.map(p => p.numPedido));

    let inserted = 0, updated = 0, deleted = 0, errors = 0;

    // ── PASSO 3: Upsert em lotes de 10 ───────────────────────────────────────
    const BATCH_SIZE = 10;
    for (let i = 0; i < pedidosList.length; i += BATCH_SIZE) {
      const batch = pedidosList.slice(i, i + BATCH_SIZE);
      console.log(`[${new Date().toISOString()}] 🔧 Lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pedidosList.length / BATCH_SIZE)} (${batch.length} pedidos)`);

      for (const p of batch) {
        try {
          const existing = existingByNumber[p.numPedido];

          if (existing) {
            // Sempre sobrescreve status; preserva campos manuais
            const updatePayload = {
              status: p.orderStatus,
              sankhya_id: p.numPedido,
            };
            if (p.requestDate && !existing.request_date) {
              updatePayload.request_date = p.requestDate.toISOString().split("T")[0];
            }
            if (p.deliveryDeadline && !existing.delivery_deadline) {
              updatePayload.delivery_deadline = p.deliveryDeadline.toISOString().split("T")[0];
            }
            if (!existing.observations && p.obs) {
              updatePayload.observations = p.obs;
            }
            await base44.asServiceRole.entities.Order.update(existing.id, updatePayload);
            updated++;
          } else {
            await base44.asServiceRole.entities.Order.create({
              order_number: p.numPedido,
              client_name: "FÁBRICA",
              request_date: p.requestDate ? p.requestDate.toISOString().split("T")[0] : null,
              delivery_deadline: p.deliveryDeadline ? p.deliveryDeadline.toISOString().split("T")[0] : null,
              delivery_type: "normal",
              status: p.orderStatus,
              observations: p.obs,
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

      if (i + BATCH_SIZE < pedidosList.length) {
        await sleep(300);
      }
    }

    // ── PASSO 4: Deletar pedidos que sumiram da API (apenas sankhya_id) ───────
    const toDelete = existingOrders.filter(o => o.sankhya_id && !apiPedidoNumbers.has(o.sankhya_id));
    if (toDelete.length > 0) {
      const deletedNumbers = toDelete.map(o => o.sankhya_id);
      console.log(`[${new Date().toISOString()}] 🗑️ Removendo ${toDelete.length} pedido(s) ausentes da API: ${deletedNumbers.join(", ")}`);
      for (const o of toDelete) {
        try {
          await base44.asServiceRole.entities.Order.delete(o.id);
          deleted++;
        } catch (err) {
          console.error(`[${new Date().toISOString()}] ❌ Erro ao deletar pedido ${o.sankhya_id}: ${err.message}`);
          errors++;
        }
      }
    } else {
      console.log(`[${new Date().toISOString()}] ✅ Nenhum pedido para remover`);
    }

    const totalMs = Date.now() - startTs;
    console.log(`[${new Date().toISOString()}] ✅ Concluído em ${(totalMs / 1000).toFixed(1)}s — ${inserted} inseridos, ${updated} atualizados, ${deleted} removidos, ${errors} erros`);

    return Response.json({
      success: true,
      inserted,
      updated,
      deleted,
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