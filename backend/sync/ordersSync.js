/**
 * Sync: Sankhya → LumeFlow
 *
 * Fluxo:
 *  1. Busca pedidos aprovados no Sankhya (STATUSNOTA = 'L')
 *  2. Para cada pedido, busca os itens (produtos)
 *  3. Verifica se o pedido já existe no LumeFlow (via sankhya_nunota)
 *  4. Se não existe → cria o Order no LumeFlow com status "confirmado"
 *  5. Se existe e mudou algum campo relevante → atualiza
 *
 * Mapeamento de campos:
 *  Sankhya TGFCAB          → LumeFlow Order
 *  ────────────────────────────────────────────
 *  NUNOTA                  → sankhya_nunota (campo de referência)
 *  NUMNOTA                 → order_number   (prefixo "SNK-")
 *  NOMEPARC                → client_name
 *  DTNEG                   → request_date
 *  DTENTSAI                → delivery_deadline
 *  OBSERVACAO              → observations
 *  CODVEND (vendedor)      → (salvo em metadata)
 *
 *  Items TGFITE            → LumeFlow Order.items[]
 *  ────────────────────────────────────────────
 *  CODPROD                 → sankhya_codprod
 *  DESCRPROD               → product_name
 *  REFERENCIA              → reference
 *  QTDNEG                  → quantity
 *  OBSERVACAO              → item_observations
 */

const sankhya = require('../sankhya/client');
const base44 = require('../base44/client');
const logger = require('../config/logger');
const { config } = require('../config');

// Rastro de execução para o endpoint /sync/status
let lastRun = null;
let lastResult = null;

async function runPullSync() {
  const startedAt = new Date();
  logger.info('[OrdersSync] ▶ Iniciando sync Sankhya → LumeFlow...');

  const stats = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Janela de busca: N dias atrás
    const since = new Date();
    since.setDate(since.getDate() - config.sync.windowDays);

    const pedidos = await sankhya.getPedidosAprovados(since);
    stats.total = pedidos.length;
    logger.info(`[OrdersSync] ${pedidos.length} pedidos aprovados encontrados no Sankhya.`);

    for (const pedido of pedidos) {
      try {
        await processPedido(pedido, stats);
      } catch (err) {
        logger.error(`[OrdersSync] Erro ao processar NUNOTA=${pedido.NUNOTA}: ${err.message}`);
        stats.errors.push({ nunota: pedido.NUNOTA, error: err.message });
      }
    }
  } catch (err) {
    logger.error(`[OrdersSync] Erro geral: ${err.message}`);
    stats.errors.push({ error: err.message });
  }

  const duration = Date.now() - startedAt.getTime();
  logger.info(
    `[OrdersSync] ✓ Concluído em ${duration}ms — criados=${stats.created} atualizados=${stats.updated} ignorados=${stats.skipped} erros=${stats.errors.length}`
  );

  lastRun = startedAt.toISOString();
  lastResult = { ...stats, durationMs: duration };
  return lastResult;
}

async function processPedido(pedido, stats) {
  const nuNota = parseInt(pedido.NUNOTA, 10);

  // Busca itens do pedido
  const itens = await sankhya.getItensPedido(nuNota);

  // Monta o payload para o LumeFlow
  const orderPayload = mapPedidoToOrder(pedido, itens);

  // Verifica se já existe no LumeFlow
  const existing = await base44.findOrderByNunota(nuNota);

  if (!existing) {
    await base44.createOrder(orderPayload);
    stats.created++;
    logger.debug(`[OrdersSync] CRIADO: ${orderPayload.order_number}`);
  } else {
    // Atualiza apenas se houve mudança em campos relevantes
    if (needsUpdate(existing, orderPayload)) {
      await base44.updateOrder(existing.id, {
        delivery_deadline: orderPayload.delivery_deadline,
        observations: orderPayload.observations,
        sankhya_items: orderPayload.sankhya_items,
      });
      stats.updated++;
      logger.debug(`[OrdersSync] ATUALIZADO: ${orderPayload.order_number}`);
    } else {
      stats.skipped++;
    }
  }
}

/**
 * Mapeia um cabeçalho Sankhya + seus itens para a estrutura Order do LumeFlow.
 */
function mapPedidoToOrder(pedido, itens) {
  return {
    order_number: `SNK-${pedido.NUMNOTA}`,
    client_name: pedido.NOMEPARC,
    request_date: parseSankhyaDate(pedido.DTNEG),
    delivery_deadline: parseSankhyaDate(pedido.DTENTSAI),
    status: 'confirmado', // Pedido aprovado no comercial entra como "confirmado"
    observations: pedido.OBSERVACAO || '',

    // Campos de rastreabilidade Sankhya
    sankhya_nunota: String(pedido.NUNOTA),
    sankhya_numnota: String(pedido.NUMNOTA),
    sankhya_codparc: String(pedido.CODPARC),
    sankhya_vendedor: String(pedido.CODVEND || ''),

    // Itens serializado como JSON (campo livre para armazenar detalhes)
    sankhya_items: JSON.stringify(
      itens.map((item) => ({
        sequencia: item.SEQUENCIA,
        codprod: item.CODPROD,
        descricao: item.DESCRPROD,
        referencia: item.REFERENCIA,
        quantidade: parseFloat(item.QTDNEG || 0),
        valor_unitario: parseFloat(item.VLRUNIT || 0),
        observacao: item.OBSERVACAO || '',
      }))
    ),
  };
}

function needsUpdate(existing, newData) {
  return (
    existing.delivery_deadline !== newData.delivery_deadline ||
    existing.observations !== newData.observations ||
    existing.sankhya_items !== newData.sankhya_items
  );
}

/**
 * Converte data no formato DD/MM/YYYY retornado pelo Sankhya para ISO string.
 */
function parseSankhyaDate(str) {
  if (!str) return null;
  // Formato: "28/03/2025 00:00:00.000" ou "28/03/2025"
  const [datePart] = str.split(' ');
  const [dd, mm, yyyy] = datePart.split('/');
  if (!dd || !mm || !yyyy) return null;
  return new Date(`${yyyy}-${mm}-${dd}`).toISOString();
}

module.exports = { runPullSync, getStatus: () => ({ lastRun, lastResult }) };
