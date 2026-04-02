/**
 * Rotas de Sincronização
 *
 * GET  /sync/status        → status da última sincronização de cada direção
 * POST /sync/pull          → força sync manual Sankhya → LumeFlow
 * POST /sync/push          → força sync manual LumeFlow → Sankhya
 * POST /sync/full          → executa ambas as direções em sequência
 */

const express = require('express');
const router = express.Router();
const { runPullSync, getStatus: getPullStatus } = require('../sync/ordersSync');
const { runPushSync, getStatus: getPushStatus } = require('../sync/productionSync');
const logger = require('../config/logger');

// Evita execuções concorrentes
let isSyncing = false;

router.get('/status', (req, res) => {
  res.json({
    pull: getPullStatus(),   // Sankhya → LumeFlow
    push: getPushStatus(),   // LumeFlow → Sankhya
    isSyncing,
  });
});

router.post('/pull', async (req, res) => {
  if (isSyncing) {
    return res.status(409).json({ error: 'Sincronização já em andamento.' });
  }
  isSyncing = true;
  try {
    logger.info('[Routes] Sync PULL disparado manualmente.');
    const result = await runPullSync();
    res.json({ ok: true, result });
  } catch (err) {
    logger.error(`[Routes] Erro no sync pull: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    isSyncing = false;
  }
});

router.post('/push', async (req, res) => {
  if (isSyncing) {
    return res.status(409).json({ error: 'Sincronização já em andamento.' });
  }
  isSyncing = true;
  try {
    logger.info('[Routes] Sync PUSH disparado manualmente.');
    const result = await runPushSync();
    res.json({ ok: true, result });
  } catch (err) {
    logger.error(`[Routes] Erro no sync push: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    isSyncing = false;
  }
});

router.post('/full', async (req, res) => {
  if (isSyncing) {
    return res.status(409).json({ error: 'Sincronização já em andamento.' });
  }
  isSyncing = true;
  try {
    logger.info('[Routes] Sync FULL disparado manualmente.');
    const pullResult = await runPullSync();
    const pushResult = await runPushSync();
    res.json({ ok: true, pull: pullResult, push: pushResult });
  } catch (err) {
    logger.error(`[Routes] Erro no sync full: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    isSyncing = false;
  }
});

module.exports = router;
