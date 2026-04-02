/**
 * Script de sincronização manual — para rodar via linha de comando
 * Uso: node scripts/manual-sync.js [pull|push|full]
 */

const { config, validate } = require('../config');
try {
  validate();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const { runPullSync } = require('../sync/ordersSync');
const { runPushSync } = require('../sync/productionSync');
const logger = require('../config/logger');

const type = process.argv[2] || 'full';

(async () => {
  try {
    if (type === 'pull' || type === 'full') {
      logger.info('Iniciando PULL (Sankhya → LumeFlow)...');
      const r = await runPullSync();
      logger.info(`PULL concluído: ${JSON.stringify(r)}`);
    }

    if (type === 'push' || type === 'full') {
      logger.info('Iniciando PUSH (LumeFlow → Sankhya)...');
      const r = await runPushSync();
      logger.info(`PUSH concluído: ${JSON.stringify(r)}`);
    }

    process.exit(0);
  } catch (err) {
    logger.error(`Erro: ${err.message}`);
    process.exit(1);
  }
})();
