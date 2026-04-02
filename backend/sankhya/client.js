/**
 * Sankhya API Client — API Gateway (SankhyaW REST)
 *
 * Usa Bearer token OAuth2 em todas as requisições.
 * Renova sessão automaticamente em caso de 401.
 *
 * Documentação: https://developer.sankhya.com.br/reference
 */

const axios = require('axios');
const authManager = require('./auth');
const logger = require('../config/logger');
const { config } = require('../config');

class SankhyaClient {
  /**
   * Executa um serviço genérico da API SankhyaW.
   *
   * @param {string} serviceName  - Nome do serviço (ex: 'DbExplorerSP.loadRecords')
   * @param {object} requestBody  - Corpo da requisição
   * @param {number} retries      - Tentativas restantes (para renovação de token)
   */
  async call(serviceName, requestBody, retries = 2) {
    const token = await authManager.getToken();
    const { baseUrl, xToken, appKey } = config.sankhya;

    const url = `${baseUrl}/mge/api.sbr?serviceName=${serviceName}&outputType=json`;
    const body = { serviceName, requestBody };

    try {
      const response = await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          token: xToken,
          appkey: appKey,
        },
        timeout: config.sankhya.timeout,
      });

      const data = response.data;

      if (data?.status === '0') {
        // Sessão/token expirado — renova e tenta de novo
        if (this._isAuthError(data) && retries > 0) {
          logger.warn(`[SankhyaClient] Token expirado, renovando... (${retries} restantes)`);
          authManager.invalidate();
          return this.call(serviceName, requestBody, retries - 1);
        }
        const msg = data?.statusMessage || JSON.stringify(data);
        throw new Error(`[SankhyaClient] Erro API (${serviceName}): ${msg}`);
      }

      return data?.responseBody;
    } catch (err) {
      if (err.response?.status === 401 && retries > 0) {
        logger.warn('[SankhyaClient] HTTP 401, renovando token...');
        authManager.invalidate();
        return this.call(serviceName, requestBody, retries - 1);
      }
      throw err;
    }
  }

  // ── Pedidos ──────────────────────────────────────────────────────────────

  /**
   * Busca cabeçalhos de pedidos de venda aprovados.
   * Tabela: TGFCAB / Entidade: CabecalhoNota
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
    };

    const result = await this.call('DatasnaMgiSP.executeQuery', body);
    return this._parseEntityRows(result, body.fields.fieldset.list);
  }

  /**
   * Busca itens de um pedido pelo NUNOTA.
   * Tabela: TGFITE / Entidade: ItemNota
   *
   * @param {number} nuNota
   */
  async getItensPedido(nuNota) {
    logger.debug(`[SankhyaClient] Buscando itens NUNOTA=${nuNota}...`);

    const fields = 'NUNOTA,SEQUENCIA,CODPROD,DESCRPROD,REFERENCIA,QTDNEG,VLRUNIT,VLRTOT,CODVOL,OBSERVACAO';

    const body = {
      entityName: 'ItemNota',
      fields: { fieldset: { list: fields } },
      criteria: { expression: { $: `this.NUNOTA = ${nuNota}` } },
      orderBy: { field: [{ $: 'SEQUENCIA', order: 'ASC' }] },
    };

    const result = await this.call('DatasnaMgiSP.executeQuery', body);
    return this._parseEntityRows(result, fields);
  }

  /**
   * Busca dados do parceiro/cliente.
   * Tabela: TGFPAR / Entidade: Parceiro
   *
   * @param {number} codParc
   */
  async getParceiro(codParc) {
    const fields = 'CODPARC,NOMEPARC,RAZAOSOCIAL,CGC_CPF,EMAIL,TELEFONE,CIDADE,UF';

    const body = {
      entityName: 'Parceiro',
      fields: { fieldset: { list: fields } },
      criteria: { expression: { $: `this.CODPARC = ${codParc}` } },
    };

    const result = await this.call('DatasnaMgiSP.executeQuery', body);
    const rows = this._parseEntityRows(result, fields);
    return rows[0] || null;
  }

  // ── Ordens de Fabricação (PCP) ───────────────────────────────────────────

  /**
   * Cria uma ordem de fabricação no Sankhya.
   * Tabela: TGFPCP / Entidade: PlanejamentoPCP
   *
   * @param {object} ordemFabricacao
   */
  async criarOrdemFabricacao({ nuNotaOrigem, codProd, qtdProduzir, dtPrevisao, observacao, referencia }) {
    logger.info(`[SankhyaClient] Criando OP fabricação CODPROD=${codProd} QTD=${qtdProduzir}...`);

    const body = {
      entityName: 'PlanejamentoPCP',
      fields: {
        CODPROD:      { $: String(codProd) },
        QTDPLANEJADA: { $: String(qtdProduzir) },
        DTPREVISAO:   { $: this._formatDate(new Date(dtPrevisao)) },
        NUNOTA:       { $: String(nuNotaOrigem) },
        OBS:          { $: observacao || '' },
        AD_REFLUME:   { $: referencia || '' }, // Campo adicional para rastreabilidade
        SITUACAO:     { $: 'A' },               // A = Aberta
      },
    };

    return this.call('DatasnaMgiSP.save', body);
  }

  /**
   * Atualiza status de uma ordem de fabricação.
   *
   * @param {number} codPcp
   * @param {'A'|'E'|'F'|'C'} situacao  A=Aberta, E=Em produção, F=Finalizada, C=Cancelada
   */
  async atualizarStatusOrdemFabricacao(codPcp, situacao) {
    logger.info(`[SankhyaClient] Atualizando CODPCP=${codPcp} → SITUACAO=${situacao}...`);

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
   * Busca OPs criadas pelo LumeFlow (campo AD_REFLUME preenchido).
   */
  async getOrdensFabricacaoLume() {
    const fields = 'CODPCP,CODPROD,DESCRPROD,QTDPLANEJADA,QTDPRODUZIDA,DTPREVISAO,SITUACAO,AD_REFLUME,NUNOTA';

    const body = {
      entityName: 'PlanejamentoPCP',
      fields: { fieldset: { list: fields } },
      criteria: {
        expression: { $: "this.AD_REFLUME IS NOT NULL AND this.AD_REFLUME != ''" },
      },
      orderBy: { field: [{ $: 'CODPCP', order: 'DESC' }] },
    };

    const result = await this.call('DatasnaMgiSP.executeQuery', body);
    return this._parseEntityRows(result, fields);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Converte resultado executeQuery em array de objetos simples.
   * Sankhya retorna: { rows: { row: [ { f: [ {$: val}, ... ] }, ... ] } }
   */
  _parseEntityRows(responseBody, fieldList) {
    const fields = (fieldList || '').split(',').map((f) => f.trim());
    const rows = responseBody?.rows?.row;
    if (!rows) return [];

    const rowArray = Array.isArray(rows) ? rows : [rows];

    return rowArray.map((row) => {
      const cells = Array.isArray(row.f) ? row.f : [row.f];
      const obj = {};
      fields.forEach((field, i) => {
        obj[field] = cells[i]?.['$'] ?? null;
      });
      return obj;
    });
  }

  /** Formata Date → DD/MM/YYYY (formato exigido pelo Sankhya) */
  _formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return [
      String(d.getDate()).padStart(2, '0'),
      String(d.getMonth() + 1).padStart(2, '0'),
      d.getFullYear(),
    ].join('/');
  }

  _isAuthError(data) {
    const msg = (data?.statusMessage || '').toLowerCase();
    return msg.includes('token') || msg.includes('session') || msg.includes('autoriza') || msg.includes('login');
  }
}

module.exports = new SankhyaClient();
