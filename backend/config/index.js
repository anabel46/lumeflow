require('dotenv').config();

const config = {
  // ── Servidor ──────────────────────────────────────────────────────────────
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // ── Sankhya ───────────────────────────────────────────────────────────────
  sankhya: {
    baseUrl: process.env.SANKHYA_BASE_URL, // ex: https://api.sankhya.com.br
    token: process.env.SANKHYA_TOKEN,       // Token gerado no portal Sankhya.ID
    appKey: process.env.SANKHYA_APP_KEY,    // Chave do aplicativo parceiro
    username: process.env.SANKHYA_USERNAME, // Usuário do sistema
    password: process.env.SANKHYA_PASSWORD, // Senha do usuário

    // Tipo de operação (CODTIPOPER) que representa pedido de venda aprovado
    // Verifique no Sankhya: Arquivo > Tipos de Operação > filtre por "Pedido de Venda"
    tipoOperacaoVenda: parseInt(process.env.SANKHYA_TIPO_OPER_VENDA || '1110', 10),

    // Status de aprovação no Sankhya (campo AD_STATUSPED ou STATUSNOTA)
    // 'L' = Liberado/Aprovado na maioria das instalações Sankhya
    statusAprovado: process.env.SANKHYA_STATUS_APROVADO || 'L',

    // Código do local de estoque da fábrica (CODLOCAL)
    localEstoqueFabrica: parseInt(process.env.SANKHYA_LOCAL_ESTOQUE || '1', 10),

    // Tipo de operação para ordens de fabricação (CODTIPOPER produção)
    tipoOperacaoFabricacao: parseInt(process.env.SANKHYA_TIPO_OPER_FABRICACAO || '2210', 10),

    // Timeout de requisições em ms
    timeout: parseInt(process.env.SANKHYA_TIMEOUT || '30000', 10),
  },

  // ── Base44 (LumeFlow backend) ─────────────────────────────────────────────
  base44: {
    appId: process.env.BASE44_APP_ID,
    apiToken: process.env.BASE44_API_TOKEN,
    baseUrl: process.env.BASE44_BASE_URL || 'https://api.base44.com',
  },

  // ── Sincronização ─────────────────────────────────────────────────────────
  sync: {
    // Intervalo de polling Sankhya → LumeFlow (cron expression)
    // Padrão: a cada 5 minutos
    pullCron: process.env.SYNC_PULL_CRON || '*/5 * * * *',

    // Intervalo de push LumeFlow → Sankhya
    pushCron: process.env.SYNC_PUSH_CRON || '*/10 * * * *',

    // Quantos dias atrás buscar pedidos aprovados (janela de busca)
    windowDays: parseInt(process.env.SYNC_WINDOW_DAYS || '30', 10),
  },

  // ── Segurança ─────────────────────────────────────────────────────────────
  // Chave secreta para autenticar webhooks recebidos do LumeFlow
  webhookSecret: process.env.WEBHOOK_SECRET || 'change-me-in-production',
};

// Validação de campos obrigatórios
function validate() {
  const required = [
    ['SANKHYA_BASE_URL', config.sankhya.baseUrl],
    ['SANKHYA_TOKEN', config.sankhya.token],
    ['SANKHYA_APP_KEY', config.sankhya.appKey],
    ['BASE44_APP_ID', config.base44.appId],
    ['BASE44_API_TOKEN', config.base44.apiToken],
  ];

  const missing = required.filter(([, val]) => !val).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `[Config] Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}\n` +
      'Copie o arquivo .env.example para .env e preencha os valores.'
    );
  }
}

module.exports = { config, validate };
