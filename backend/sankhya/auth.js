/**
 * Sankhya Auth Manager
 *
 * Gerencia o ciclo de vida do token de sessão (JSESSIONID) da API SankhyaW.
 *
 * Fluxo:
 *  1. POST /mge/api.sbr?serviceName=MobileLoginSP.login  → obtém jsessionid
 *  2. Todas as requisições subsequentes enviam o cookie JSESSIONID
 *  3. Em caso de 401/sessão expirada, renova automaticamente
 */

const axios = require('axios');
const logger = require('../config/logger');
const { config } = require('../config');

class SankhyaAuthManager {
  constructor() {
    this._jsessionid = null;
    this._expiresAt = null;
    // Sessão válida por 50 min (Sankhya expira em ~60 min)
    this._sessionTtlMs = 50 * 60 * 1000;
    this._loginPromise = null;
  }

  /**
   * Retorna um JSESSIONID válido, fazendo login se necessário.
   */
  async getSession() {
    if (this._isValid()) return this._jsessionid;

    // Evita múltiplos logins simultâneos
    if (!this._loginPromise) {
      this._loginPromise = this._login().finally(() => {
        this._loginPromise = null;
      });
    }
    return this._loginPromise;
  }

  /** Invalida a sessão atual e força novo login na próxima chamada. */
  invalidate() {
    logger.warn('[SankhyaAuth] Sessão invalidada manualmente.');
    this._jsessionid = null;
    this._expiresAt = null;
  }

  _isValid() {
    return this._jsessionid && this._expiresAt && Date.now() < this._expiresAt;
  }

  async _login() {
    const { baseUrl, token, appKey, username, password } = config.sankhya;

    logger.info('[SankhyaAuth] Iniciando autenticação...');

    const url = `${baseUrl}/mge/api.sbr?serviceName=MobileLoginSP.login&outputType=json`;

    const body = {
      serviceName: 'MobileLoginSP.login',
      requestBody: {
        NOMUSU: { $: username },
        INTERNO: { $: password },
        KEEPCONNECTED: { $: 'S' },
      },
    };

    const response = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        token,
        appkey: appKey,
      },
      timeout: config.sankhya.timeout,
    });

    const data = response.data;

    if (data?.status !== '1') {
      const msg = data?.statusMessage || JSON.stringify(data);
      throw new Error(`[SankhyaAuth] Falha no login: ${msg}`);
    }

    // O JSESSIONID vem no cookie Set-Cookie OU no campo sessionid do body
    const sessionFromBody = data?.responseBody?.jsessionid?.['$'];
    const cookieHeader = response.headers['set-cookie'] || [];
    const cookieSession = cookieHeader
      .find((c) => c.startsWith('JSESSIONID='))
      ?.split(';')[0]
      ?.replace('JSESSIONID=', '');

    this._jsessionid = sessionFromBody || cookieSession;

    if (!this._jsessionid) {
      throw new Error('[SankhyaAuth] Sessão não retornada pela API.');
    }

    this._expiresAt = Date.now() + this._sessionTtlMs;
    logger.info('[SankhyaAuth] Autenticado com sucesso. Sessão válida por 50 min.');
    return this._jsessionid;
  }
}

// Singleton compartilhado por toda a aplicação
const authManager = new SankhyaAuthManager();
module.exports = authManager;
