/**
 * Webhook Handler
 *
 * Recebe notificações do LumeFlow (via Base44 webhooks) para reagir
 * em tempo real a eventos — sem precisar aguardar o próximo ciclo de polling.
 *
 * Eventos suportados:
 *  - production_order.created   → cria imediatamente no Sankhya
 *  - production_order.updated   → atualiza status no Sankhya
 *  - order.cancelled            → cancela no Sankhya
 *
 * Configuração no Base44:
 *  Painel Base44 > Integrações > Webhooks > URL: https://SEU-SERVIDOR/webhook/lumeflow
 *  Secret: valor de WEBHOOK_SECRET no .env
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { runPushSync } = require('../sync/productionSync');
const sankhya = require('../sankhya/client');
const base44 = require('../base44/client');
const logger = require('../config/logger');
const { config } = require('../config');

// ── Middleware de validação de assinatura HMAC ───────────────────────────────
function validateSignature(req, res, next) {
  const signature = req.headers['x-lumeflow-signature'];
  if (!signature) {
    return res.status(401).json({ error: 'Assinatura ausente.' });
  }

  const expected = crypto
    .createHmac('sha256', config.webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  const trusted = `sha256=${expected}`;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(trusted))) {
    logger.warn('[Webhook] Assinatura inválida recebida.');
    return res.status(403).json({ error: 'Assinatura inválida.' });
  }
  next();
}

// ── POST /webhook/lumeflow ────────────────────────────────────────────────────
router.post('/lumeflow', validateSignature, async (req, res) => {
  const { event, data } = req.body;

  logger.info(`[Webhook] Evento recebido: "${event}"`);

  // Responde imediatamente para evitar timeout no Base44
  res.json({ received: true });

  // Processa de forma assíncrona
  try {
    switch (event) {
      case 'production_order.created':
      case 'production_order.updated':
        // Executa push sync para capturar a nova OP / atualização de status
        await runPushSync();
        break;

      case 'order.cancelled': {
        // Cancela o pedido no Sankhya se tiver NUNOTA vinculado
        const nuNota = data?.sankhya_nunota;
        if (nuNota) {
          logger.info(`[Webhook] Cancelando pedido Sankhya NUNOTA=${nuNota}...`);
          // Atualiza todas as OPs vinculadas ao pedido como canceladas
          const ops = await base44.listProductionOrders({ order_id: data.id });
          for (const op of ops) {
            if (op.sankhya_codpcp) {
              await sankhya.atualizarStatusOrdemFabricacao(
                parseInt(op.sankhya_codpcp, 10),
                'C'
              );
            }
          }
        }
        break;
      }

      default:
        logger.debug(`[Webhook] Evento "${event}" não tratado.`);
    }
  } catch (err) {
    logger.error(`[Webhook] Erro ao processar evento "${event}": ${err.message}`);
  }
});

module.exports = router;
