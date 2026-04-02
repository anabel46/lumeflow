/**
 * Sankhya API Client
 *
 * Encapsula todas as chamadas REST para a API SankhyaW.
 * Usa o AuthManager para gerenciar sessão automaticamente.
 *
 * Documentação da API SankhyaW:
 * https://developer.sankhya.com.br/reference
 */

const axios = require('axios');
const authManager = require('./auth');
const logger = require('../config/logger');
const { config } = require('../config');

class SankhyaClient {
  /**
   * Executa um serviço genérico da API SankhyaW.
   * Renova sessão automaticamente em caso de 401.
   *
   * @param {string} serviceName  - Nome do serviço (ex: 'DbExplorerSP.loadRecords')
   * @param {object} requestBody  - Corpo da requisição
   * @param {number} retries      - Tentativas restantes
   */
  async call(serviceName, requestBody, retries = 2) {
    const jsessionid = await authManager.getSession();
    const { baseUrl, token, appKey } = config.sankhya;

    const url = `${baseUrl}/mge/api.sbr?serviceName=${serviceName}&outputType=json`;

    const body = { serviceName, requestBody };

    try {
      const response = await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json',
          token,
          appkey: appKey,
          Cookie: `JSESSIONID=${jsessionid}`,
        },
        timeout: config.sankhya.timeout,
      });

      const data = response.data;

      // Sessão expirada — renova e tenta de novo
      if (data?.status === '0' && this._isSessionError(data)) {
        if (retries > 0) {
          logger.warn(`[SankhyaClient] Sessão expirada, renovando... (${retries} tentativas restantes)`);
          authManager.invalidate();
          return this.call(serviceName, requestBody, retries - 1);
        }
        throw new Error('[SankhyaClient] Sessão expirada e renovação falhou.');
      }

      if (data?.status === '0') {
        const msg = data?.statusMessage || JSON.stringify(data);
        throw new Error(`[SankhyaClient] Erro API Sankhya (${serviceName}): ${msg}`);
      }

      return data?.responseBody;
    } catch (err) {
      if (err.response?.status === 401 && retries > 0) {
        logger.warn('[SankhyaClient] HTTP 401 recebido, renovando sessão...');
        authManager.invalidate();
        return this.call(serviceName, requestBody, retries - 1);
      }
      throw err;
    }
  }

  // ── Pedidos ──────────────────────────────────────────────────────────────

  /**
   * Busca cabeçalhos de pedidos aprovados de venda.
   *
   * Tabela: TGFCAB
   * Filtros: CODTIPOPER = tipoOperacaoVenda AND STATUSNOTA = 'L' (Liberado)
   *
   * @param {Date} since - Buscar pedidos a partir desta data
   */
  async getPedidosAprovados(since) {
    const { tipoOperacaoVenda, statusAprovado } = config.sankhya;
    const dtFormatada = this._formatDate(since);

    logger.info(`[SankhyaClient] Buscando pedidos aprovados desde ${dtFormatada}...`);

    const body = {
      entityName: 'CabecalhoNota',
      fields: {
        fieldset: {
          list: 'NUNOTA,NUMNOTA,CODPARC,NOMEPARC,DTNEG,DTENTSAI,CODTIPOPER,STATUSNOTA,OBSERVACAO,VLRNOTA,CODVEND',
        },
      },
      criteria: {
        expression: {
          $: `this.CODTIPOPER = ${tipoOperacaoVenda} AND this.STATUSNOTA = '${statusAprovado}' AND this.DTNEG >= '${dtFormatada}'`,
        },
      },
      orderBy: { field: [{ $: 'DTNEG', order: 'DESC' }] },
      // Máximo de 500 registros por chamada
      criteria_extra: { limit: { $: '500' } },
    };

    const result = await this.call('DatasnaMgiSP.executeQuery', body);
    return this._parseEntityRows(result);
  }

  /**
   * Busca os itens de um pedido pelo NUNOTA.
   *
   * Tabela: TGFITE
   *
   * @param {number} nuNota - Número único da nota (NUNOTA)
   */
  async getItensPedido(nuNota) {
    logger.debug(`[SankhyaClient] Buscando itens do pedido NUNOTA=${nuNota}...`);

    const body = {
      entityName: 'ItemNota',
      fields: {
        fieldset: {
          list: 'NUNOTA,SEQUENCIA,CODPROD,DESCRPROD,REFERENCIA,QTDNEG,VLRUNIT,VLRTOT,CODVOL,CODLOCAL,OBSERVACAO',
        },
      },
      criteria: {
        expression: { $: `this.NUNOTA = ${nuNota}` },
      },
      orderBy: { field: [{ $: 'SEQUENCIA', order: 'ASC' }] },
    };

    const result = await this.call('DatasnaMgiSP.executeQuery', body);
    return this._parseEntityRows(result);
  }

  /**
   * Busca dados do parceiro/cliente.
   *
   * Tabela: TGFPAR
   *
   * @param {number} codParc - Código do parceiro
   */
  async getParceiro(codParc) {
    const body = {
      entityName: 'Parceiro',
      fields: {
        fieldset: {
          list: 'CODPARC,NOMEPARC,RAZAOSOCIAL,CGC_CPF,EMAIL,TELEFONE,CIDADE,UF',
        },
      },
      criteria: {
        expression: { $: `this.CODPARC = ${codParc}` },
      },
    };

    const result = await this.call('DatasnaMgiSP.executeQuery', body);
    const rows = this._parseEntityRows(result);
    return rows[0] || null;
  }

  // ── Ordens de Fabricação ─────────────────────────────────────────────────

  /**
   * Cria uma ordem de fabricação no Sankhya.
   *
   * Tabela: TGFPCP (Planejamento e Controle de Produção)
   *
   * @param {object} ordemFabricacao - Dados da ordem
   */
  async criarOrdemFabricacao(ordemFabricacao) {
    const {
      nuNotaOrigem,   // NUNOTA do pedido de venda de origem
      codProd,        // Código do produto
      qtdProduzir,    // Quantidade a produzir
      dtPrevisao,     // Data previsão de conclusão
      observacao,     // Observações
      referencia,     // Referência do produto (campo livre)
    } = ordemFabricacao;

    logger.info(`[SankhyaClient] Criando ordem de fabricação para CODPROD=${codProd} QTD=${qtdProduzir}...`);

    const body = {
      entityName: 'PlanejamentoPCP',
      fields: {
        CODPROD: { $: String(codProd) },
        QTDPLANEJADA: { $: String(qtdProduzir) },
        DTPREVISAO: { $: this._formatDate(new Date(dtPrevisao)) },
        NUNOTA: { $: String(nuNotaOrigem) },
        OBS: { $: observacao || '' },
        AD_REFLUME: { $: referencia || '' }, // Campo adicional customizado
        SITUACAO: { $: 'A' }, // A = Aberta
      },
    };

    const result = await this.call('DatasnaMgiSP.save', body);
    return result;
  }

  /**
   * Atualiza o status de uma ordem de fabricação no Sankhya.
   *
   * @param {number} codPcp  - Código PCP (CODPCP)
   * @param {string} situacao - 'A'=Aberta, 'E'=Em produção, 'F'=Finalizada, 'C'=Cancelada
   */
  async atualizarStatusOrdemFabricacao(codPcp, situacao) {
    logger.info(`[SankhyaClient] Atualizando CODPCP=${codPcp} para SITUACAO=${situacao}...`);

    const body = {
      entityName: 'PlanejamentoPCP',
      key: { CODPCP: { $: String(codPcp) } },
      fields: {
        SITUACAO: { $: situacao },
        AD_DTATUALIZACAO: { $: this._formatDate(new Date()) },
      },
    };

    return this.call('DatasnaMgiSP.save', body);
  }

  /**
   * Busca ordens de fabricação criadas pelo LumeFlow (campo AD_REFLUME preenchido).
   * Usado para sincronização reversa de status.
   */
  async getOrdensFabricacaoLume() {
    const body = {
      entityName: 'PlanejamentoPCP',
      fields: {
        fieldset: {
          list: 'CODPCP,CODPROD,DESCRPROD,QTDPLANEJADA,QTDPRODUZIDA,DTPREVISAO,SITUACAO,AD_REFLUME,NUNOTA',
        },
      },
      criteria: {
        expression: { $: "this.AD_REFLUME IS NOT NULL AND this.AD_REFLUME != ''" },
      },
      orderBy: { field: [{ $: 'CODPCP', order: 'DESC' }] },
    };

    const result = await this.call('DatasnaMgiSP.executeQuery', body);
    return this._parseEntityRows(result);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Converte o resultado de executeQuery em array de objetos simples.
   * O Sankhya retorna linhas no formato: { f: [ {$: valor}, ... ] }
   */
  _parseEntityRows(responseBody) {
    const fields = responseBody?.fields?.fieldset?.list?.split(',') || [];
    const rows = responseBody?.rows?.row;

    if (!rows) return [];
    const rowArray = Array.isArray(rows) ? rows : [rows];

    return rowArray.map((row) => {
      const cells = Array.isArray(row.f) ? row.f : [row.f];
      const obj = {};
      fields.forEach((field, i) => {
        obj[field.trim()] = cells[i]?.['$'] ?? null;
      });
      return obj;
    });
  }

  /** Formata uma Date para DD/MM/YYYY exigido pela API Sankhya */
  _formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  _isSessionError(data) {
    const msg = (data?.statusMessage || '').toLowerCase();
    return msg.includes('sessão') || msg.includes('session') || msg.includes('login');
  }
}

module.exports = new SankhyaClient();
