/**
 * Sync: LumeFlow → Sankhya
 *
 * Fluxo:
 *  1. Busca ordens de produção no LumeFlow que ainda não têm código PCP (sankhya_codpcp vazio)
 *  2. Para cada OP, cria uma ordem de fabricação no Sankhya (PlanejamentoPCP)
 *  3. Salva o CODPCP retornado no campo sankhya_codpcp da OP no LumeFlow
 *  4. Em execuções subsequentes, sincroniza atualizações de status:
 *     LumeFlow status → Sankhya SITUACAO
 *
 * Mapeamento de status:
 *  LumeFlow            → Sankhya PCP SITUACAO
 *  ─────────────────────────────────────────────
 *  planejamento        → A (Aberta)
 *  em_producao         → E (Em execução)  [campo personalizado]
 *  finalizado          → F (Finalizada)
 *  cancelado           → C (Cancelada)
 *  pausado             → A (Reaberta como aberta)
 */

const sankhya = require('../sankhya/client');
const base44 = require('../base44/client');
const logger = require('../config/logger');

// Status map LumeFlow → Sankhya PCP
const STATUS_MAP = {
  planejamento: 'A',
  aguardando: 'A',
  em_producao: 'E',
  finalizado: 'F',
  cancelado: 'C',
  pausado: 'A',
};

let lastRun = null;
let lastResult = null;

async function runPushSync() {
  const startedAt = new Date();
  logger.info('[ProductionSync] ▶ Iniciando sync LumeFlow → Sankhya...');

  const stats = {
    created: 0,
    statusUpdated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    await createPendingOrders(stats);
    await syncStatusUpdates(stats);
  } catch (err) {
    logger.error(`[ProductionSync] Erro geral: ${err.message}`);
    stats.errors.push({ error: err.message });
  }

  const duration = Date.now() - startedAt.getTime();
  logger.info(
    `[ProductionSync] ✓ Concluído em ${duration}ms — criadas=${stats.created} status_sync=${stats.statusUpdated} ignoradas=${stats.skipped} erros=${stats.errors.length}`
  );

  lastRun = startedAt.toISOString();
  lastResult = { ...stats, durationMs: duration };
  return lastResult;
}

/**
 * Cria no Sankhya as OPs do LumeFlow que ainda não possuem CODPCP.
 */
async function createPendingOrders(stats) {
  const pendingOps = await base44.getPendingProductionOrders();
  logger.info(`[ProductionSync] ${pendingOps.length} OPs pendentes de envio ao Sankhya.`);

  for (const op of pendingOps) {
    try {
      // Precisa ter NUNOTA do pedido de origem para vincular no Sankhya
      const order = await getOrderForOp(op);
      if (!order?.sankhya_nunota) {
        logger.debug(`[ProductionSync] OP ${op.unique_number} sem NUNOTA de origem, pulando.`);
        stats.skipped++;
        continue;
      }

      const result = await sankhya.criarOrdemFabricacao({
        nuNotaOrigem: parseInt(order.sankhya_nunota, 10),
        codProd: op.sankhya_codprod || op.reference || op.product_id,
        qtdProduzir: op.quantity,
        dtPrevisao: op.delivery_deadline || new Date(),
        observacao: buildObservation(op),
        referencia: op.unique_number, // Ex: OP-00123 — salvo no AD_REFLUME
      });

      // Extrai o CODPCP retornado pelo Sankhya
      const codPcp = extractCodPcp(result);

      if (codPcp) {
        await base44.updateProductionOrder(op.id, {
          sankhya_codpcp: String(codPcp),
          sankhya_synced_at: new Date().toISOString(),
        });
        stats.created++;
        logger.info(`[ProductionSync] OP ${op.unique_number} → Sankhya CODPCP=${codPcp}`);
      } else {
        logger.warn(`[ProductionSync] OP ${op.unique_number}: CODPCP não retornado pelo Sankhya.`);
        stats.errors.push({ op: op.unique_number, error: 'CODPCP não retornado' });
      }
    } catch (err) {
      logger.error(`[ProductionSync] Erro na OP ${op.unique_number}: ${err.message}`);
      stats.errors.push({ op: op.unique_number, error: err.message });
    }
  }
}

/**
 * Sincroniza atualizações de status das OPs que já possuem CODPCP.
 */
async function syncStatusUpdates(stats) {
  // Busca todas as OPs que têm CODPCP (já foram enviadas ao Sankhya)
  const allOps = await base44.listProductionOrders();
  const syncedOps = allOps.filter((op) => op.sankhya_codpcp && op.sankhya_last_status !== op.status);

  logger.info(`[ProductionSync] ${syncedOps.length} OPs com status divergente para atualizar no Sankhya.`);

  for (const op of syncedOps) {
    try {
      const situacao = STATUS_MAP[op.status];
      if (!situacao) {
        stats.skipped++;
        continue;
      }

      await sankhya.atualizarStatusOrdemFabricacao(
        parseInt(op.sankhya_codpcp, 10),
        situacao
      );

      // Marca o status que foi enviado ao Sankhya
      await base44.updateProductionOrder(op.id, {
        sankhya_last_status: op.status,
        sankhya_status_synced_at: new Date().toISOString(),
      });

      stats.statusUpdated++;
      logger.debug(`[ProductionSync] OP ${op.unique_number}: status "${op.status}" → Sankhya "${situacao}"`);
    } catch (err) {
      logger.error(`[ProductionSync] Erro ao atualizar status OP ${op.unique_number}: ${err.message}`);
      stats.errors.push({ op: op.unique_number, error: err.message });
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getOrderForOp(op) {
  if (!op.order_id) return null;
  try {
    const orders = await base44.listOrders({ id: op.order_id });
    return orders?.[0] || null;
  } catch {
    return null;
  }
}

function buildObservation(op) {
  const parts = [
    `OP LumeFlow: ${op.unique_number}`,
    op.product_name ? `Produto: ${op.product_name}` : '',
    op.color ? `Cor/Acabamento: ${op.color}` : '',
    op.complement ? `Complemento: ${op.complement}` : '',
    op.observations ? `Obs: ${op.observations}` : '',
  ].filter(Boolean);
  return parts.join(' | ');
}

function extractCodPcp(result) {
  // O Sankhya retorna o PK da entidade salva de formas diferentes dependendo da versão
  return (
    result?.pk?.CODPCP?.['$'] ||
    result?.pk?.codpcp?.['$'] ||
    result?.CODPCP?.['$'] ||
    null
  );
}

module.exports = { runPushSync, getStatus: () => ({ lastRun, lastResult }) };
