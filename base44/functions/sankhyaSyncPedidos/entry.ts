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
  return "confirmado"; // P sem atividade em execução = confirmado (liberado)
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── SQL: agrega pedidos únicos com suas OPs e primeira data de inclusão ─────
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
  AND P.IDIPROC >= (SELECT MAX(IDIPROC) - 3000 FROM TPRIPROC)
GROUP BY COALESCE(CAB.NUMPEDIDO, P.NUNOTA), P.STATUSPROC
ORDER BY NUMPEDIDO DESC`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
    const urlSankhya = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

    console.log("🔄 Buscando pedidos do Sankhya...");
    const raw = await fetchSankhya(urlSankhya, {
      method: "POST",
      body: JSON.stringify({ serviceName: "DbExplorerSP.executeQuery", requestBody: { sql: SQL_PEDIDOS } }),
    }, 25_000).then(r => r.json());

    if (String(raw.status) !== "1") throw new Error(`Erro Sankhya: ${raw.statusMessage}`);

    const rows = raw.responseBody?.rows || [];
    const meta = raw.responseBody?.fieldsMetadata || [];
    const idx = buildIdx(meta);

    // Agrupa por numeroPedido (pode ter múltiplas linhas por pedido se status diferente)
    const pedidosMap = {};
    for (const row of rows) {
      const numPedido = String(getLong(row, idx, "NUMPEDIDO") || "");
      if (!numPedido) continue;

      const situacao = getString(row, idx, "SITUACAO_GERAL");
      const dhRaw = getString(row, idx, "PRIMEIRA_DHINCLUSAO");
      const temEmExecucao = getLong(row, idx, "TEM_EM_EXECUCAO") === 1;
      const referencia = getString(row, idx, "REFERENCIA");
      const descrprod = getString(row, idx, "DESCRPROD");

      // Se já tem esse pedido, mescla (prioriza status mais ativo)
      if (pedidosMap[numPedido]) {
        const existing = pedidosMap[numPedido];
        // Prioridade: A (em produção) > P (planejamento) > F (finalizado)
        const prioridade = { A: 3, P: 2, F: 1 };
        if ((prioridade[situacao] || 0) > (prioridade[existing.situacao] || 0)) {
          existing.situacao = situacao;
        }
        existing.temEmExecucao = existing.temEmExecucao || temEmExecucao;
        if (!existing.dhRaw && dhRaw) existing.dhRaw = dhRaw;
      } else {
        pedidosMap[numPedido] = { numPedido, situacao, dhRaw, temEmExecucao, referencia, descrprod };
      }
    }

    const pedidosList = Object.values(pedidosMap);
    console.log(`📦 Pedidos únicos encontrados: ${pedidosList.length}`);

    // Busca registros existentes na entidade Order
    const existingOrders = await base44.asServiceRole.entities.Order.list("-created_date", 9999);
    const existingByNumber = {};
    for (const o of existingOrders) {
      existingByNumber[o.order_number] = o;
    }

    let inserted = 0, updated = 0, errors = 0;

    for (const p of pedidosList) {
      try {
        const requestDate = parseSankhyaDate(p.dhRaw);
        const deliveryDeadline = requestDate
          ? new Date(requestDate.getTime() + 20 * 24 * 60 * 60 * 1000)
          : null;

        const orderStatus = mapOrderStatus(p.situacao, p.temEmExecucao);

        const obs = [p.referencia, p.descrprod].filter(Boolean).join(" - ") || null;

        const existing = existingByNumber[p.numPedido];

        if (existing) {
          // Atualiza apenas campos que NÃO são editáveis pelo usuário:
          // status, prazo, observações (se estiver vazio), sankhya_id
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
          // Cria novo pedido
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

        await sleep(150);
      } catch (err) {
        if (err.message?.includes("Rate limit")) {
          await sleep(3000);
        }
        console.error(`❌ Erro pedido ${p.numPedido}:`, err.message);
        errors++;
      }
    }

    console.log(`✅ Pedidos: ${inserted} inseridos, ${updated} atualizados, ${errors} erros`);
    return Response.json({ success: true, inserted, updated, errors, total: pedidosList.length });

  } catch (error) {
    console.error("❌ Erro sankhyaSyncPedidos:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});