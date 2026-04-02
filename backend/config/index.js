require('dotenv').config();

const config = {
  // ── Servidor ──────────────────────────────────────────────────────────────
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // ── Sankhya ───────────────────────────────────────────────────────────────
  sankhya: {
    // URL base do servidor Sankhya (sem barra final)
    // Cloud:   https://api.sankhya.com.br
    // On-prem: https://sankhya.suaempresa.com.br
    baseUrl: process.env.SANKHYA_BASE_URL,

    // ── Credenciais OAuth2 (Sankhya.ID / API Gateway) ──────────────────────
    clientId:     process.env.SANKHYA_CLIENT_ID,      // Client ID do aplicativo
    clientSecret: process.env.SANKHYA_CLIENT_SECRET,  // Client Secret do aplicativo
    xToken:       process.env.SANKHYA_X_TOKEN,        // Header "token" (X-Token)
    appKey:       process.env.SANKHYA_APP_KEY,        // App Key (opcional, mas recomendado)

    // ── Usuário operador ────────────────────────────────────────────────────
    username: process.env.SANKHYA_USERNAME,
    password: process.env.SANKHYA_PASSWORD,

    // ── Parâmetros de negócio ───────────────────────────────────────────────
    // CODTIPOPER do "Pedido de Venda" aprovado pelo comercial
    // Verifique: Sankhya > Arquivo > Tipos de Operação > Pedido de Venda
    tipoOperacaoVenda: parseInt(process.env.SANKHYA_TIPO_OPER_VENDA || '1110', 10),

    // Status de aprovado no campo STATUSNOTA: 'L' = Liberado (padrão)
    statusAprovado: process.env.SANKHYA_STATUS_APROVADO || 'L',

    // CODLOCAL do estoque da fábrica
    localEstoqueFabrica: parseInt(process.env.SANKHYA_LOCAL_ESTOQUE || '1', 10),

    // CODTIPOPER para ordens de fabricação (PCP)
    tipoOperacaoFabricacao: parseInt(process.env.SANKHYA_TIPO_OPER_FABRICACAO || '2210', 10),

    timeout: parseInt(process.env.SANKHYA_TIMEOUT || '30000', 10),
  },

  // ── Base44 (LumeFlow backend) ─────────────────────────────────────────────
  base44: {
    appId:   process.env.BASE44_APP_ID,
    apiToken: process.env.BASE44_API_TOKEN,
    baseUrl: process.env.BASE44_BASE_URL || 'https://api.base44.com',
  },

  // ── Sincronização ─────────────────────────────────────────────────────────
  sync: {
    pullCron:    process.env.SYNC_PULL_CRON  || '*/5 * * * *',
    pushCron:    process.env.SYNC_PUSH_CRON  || '*/10 * * * *',
    windowDays:  parseInt(process.env.SYNC_WINDOW_DAYS || '30', 10),
  },

  // ── Segurança ─────────────────────────────────────────────────────────────
  webhookSecret: process.env.WEBHOOK_SECRET || 'change-me-in-production',
};

function validate() {
  const required = [
    ['SANKHYA_BASE_URL',      config.sankhya.baseUrl],
    ['SANKHYA_CLIENT_ID',     config.sankhya.clientId],
    ['SANKHYA_CLIENT_SECRET', config.sankhya.clientSecret],
    ['SANKHYA_X_TOKEN',       config.sankhya.xToken],
    ['SANKHYA_USERNAME',      config.sankhya.username],
    ['SANKHYA_PASSWORD',      config.sankhya.password],
    ['BASE44_APP_ID',         config.base44.appId],
    ['BASE44_API_TOKEN',      config.base44.apiToken],
  ];

  const missing = required.filter(([, val]) => !val).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `[Config] Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}\n` +
      'Copie backend/.env.example para backend/.env e preencha os valores.'
    );
  }
}

module.exports = { config, validate };
