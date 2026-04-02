/**
 * LumeFlow ↔ Sankhya Integration Service
 *
 * Servidor Express que orquestra a sincronização bidirecional
 * entre o sistema LumeFlow e o ERP Sankhya.
 *
 * Inicialização:
 *   cd backend && npm install && npm start
 *   (ou npm run dev para hot-reload)
 */

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

// Carrega variáveis de ambiente e valida antes de qualquer coisa
const { config, validate } = require('./config');
try {
  validate();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const logger = require('./config/logger');
const syncRouter = require('./routes/sync');
const webhookRouter = require('./routes/webhook');
const { runPullSync } = require('./sync/ordersSync');
const { runPushSync } = require('./sync/productionSync');

// ── App Express ───────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT'],
}));

app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'lumeflow-sankhya-bridge',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── Rotas ─────────────────────────────────────────────────────────────────────
app.use('/sync', syncRouter);
app.use('/webhook', webhookRouter);

// ── Agendamento de sincronização automática ───────────────────────────────────
function scheduleSyncJobs() {
  // PULL: Sankhya → LumeFlow (busca pedidos aprovados)
  cron.schedule(config.sync.pullCron, async () => {
    logger.info(`[Cron] ⏰ Pull sync agendado iniciando... (${config.sync.pullCron})`);
    try {
      await runPullSync();
    } catch (err) {
      logger.error(`[Cron] Erro no pull sync: ${err.message}`);
    }
  });

  // PUSH: LumeFlow → Sankhya (envia ordens de fabricação)
  cron.schedule(config.sync.pushCron, async () => {
    logger.info(`[Cron] ⏰ Push sync agendado iniciando... (${config.sync.pushCron})`);
    try {
      await runPushSync();
    } catch (err) {
      logger.error(`[Cron] Erro no push sync: ${err.message}`);
    }
  });

  logger.info(`[Cron] Jobs agendados:`);
  logger.info(`  Pull (Sankhya → LumeFlow): ${config.sync.pullCron}`);
  logger.info(`  Push (LumeFlow → Sankhya): ${config.sync.pushCron}`);
}

// ── Inicialização ─────────────────────────────────────────────────────────────
app.listen(config.port, async () => {
  logger.info('═══════════════════════════════════════════════════');
  logger.info(' LumeFlow ↔ Sankhya Integration Service');
  logger.info(`  Porta : ${config.port}`);
  logger.info(`  Env   : ${config.nodeEnv}`);
  logger.info('═══════════════════════════════════════════════════');

  // Agenda os jobs de sincronização
  scheduleSyncJobs();

  // Executa um sync inicial ao subir o serviço
  if (config.nodeEnv !== 'test') {
    logger.info('[Server] Executando sincronização inicial...');
    try {
      await runPullSync();
      await runPushSync();
    } catch (err) {
      logger.warn(`[Server] Sync inicial com erro (continuando): ${err.message}`);
    }
  }
});

// ── Tratamento de erros não capturados ────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error(`[Process] unhandledRejection: ${reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`[Process] uncaughtException: ${err.message}`);
  process.exit(1);
});

module.exports = app;
