/**
 * Base44 API Client
 *
 * Acessa as entidades do LumeFlow via API REST do Base44.
 * Documentação: https://docs.base44.com/api
 */

const axios = require('axios');
const logger = require('../config/logger');
const { config } = require('../config');

class Base44Client {
  constructor() {
    this._http = axios.create({
      baseURL: `${config.base44.baseUrl}/api/apps/${config.base44.appId}/entities`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.base44.apiToken}`,
      },
      timeout: 15000,
    });
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  /**
   * Lista pedidos do LumeFlow com filtros opcionais.
   * @param {object} filters - Ex: { status: 'confirmado' }
   */
  async listOrders(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => params.set(k, v));
    const qs = params.toString() ? `?${params.toString()}` : '';

    const { data } = await this._http.get(`/Order${qs}`);
    return data;
  }

  /**
   * Cria um pedido no LumeFlow.
   * @param {object} order
   */
  async createOrder(order) {
    const { data } = await this._http.post('/Order', order);
    logger.info(`[Base44] Pedido criado: ${data.order_number} (id=${data.id})`);
    return data;
  }

  /**
   * Atualiza um pedido existente.
   * @param {string} id     - ID do pedido no Base44
   * @param {object} patch  - Campos a atualizar
   */
  async updateOrder(id, patch) {
    const { data } = await this._http.put(`/Order/${id}`, patch);
    return data;
  }

  /**
   * Busca pedido pelo número do pedido Sankhya (campo sankhya_nunota).
   * Retorna null se não encontrar.
   */
  async findOrderByNunota(nuNota) {
    const orders = await this.listOrders({ sankhya_nunota: String(nuNota) });
    return orders?.[0] || null;
  }

  // ── Production Orders ─────────────────────────────────────────────────────

  /**
   * Lista ordens de produção com filtros.
   * @param {object} filters
   */
  async listProductionOrders(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => params.set(k, v));
    const qs = params.toString() ? `?${params.toString()}` : '';

    const { data } = await this._http.get(`/ProductionOrder${qs}`);
    return data;
  }

  /**
   * Atualiza uma ordem de produção.
   * @param {string} id
   * @param {object} patch
   */
  async updateProductionOrder(id, patch) {
    const { data } = await this._http.put(`/ProductionOrder/${id}`, patch);
    return data;
  }

  /**
   * Busca ordens de produção que ainda não foram enviadas ao Sankhya.
   * (Filtra por sankhya_codpcp IS NULL ou vazio)
   */
  async getPendingProductionOrders() {
    // Busca OPs com status relevante e sem código Sankhya vinculado
    const all = await this.listProductionOrders();
    return all.filter(
      (op) =>
        !op.sankhya_codpcp &&
        op.status !== 'cancelado' &&
        op.order_id // deve ter pedido de origem
    );
  }
}

module.exports = new Base44Client();
