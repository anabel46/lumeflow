/**
 * Sankhya Auth Manager — OAuth2 (API Gateway / Sankhya.ID)
 *
 * Fluxo:
 *  POST https://api.sankhya.com.br/auth/oauth/token
 *  grant_type=password + client_id + client_secret + username + password
 *  → retorna { access_token, refresh_token, expires_in, token_type }
 *
 *  Renovação automática via refresh_token quando o access_token expirar.
 *
 * Referência:
 *  https://developer.sankhya.com.br/reference/autenticacao
 */

const axios = require('axios');
const logger = require('../config/logger');
const { config } = require('../config');

class SankhyaAuthManager {
  constructor() {
    this._accessToken = null;
    this._refreshToken = null;
    this._expiresAt = null;
    this._loginPromise = null;
  }

  /**
   * Retorna um access_token válido.
   * Faz login ou refresh automaticamente quando necessário.
   */
  async getToken() {
    if (this._isValid()) return this._accessToken;

    // Evita múltiplas chamadas simultâneas
    if (!this._loginPromise) {
      const action = this._refreshToken ? this._refresh.bind(this) : this._login.bind(this);
      this._loginPromise = action().finally(() => { this._loginPromise = null; });
    }
    return this._loginPromise;
  }

  /** Invalida tokens e força novo login. */
  invalidate() {
    logger.warn('[SankhyaAuth] Tokens invalidados, próxima chamada fará login.');
    this._accessToken = null;
    this._refreshToken = null;
    this._expiresAt = null;
  }

  _isValid() {
    // Considera expirado 60s antes para evitar race conditions
    return this._accessToken && this._expiresAt && Date.now() < this._expiresAt - 60_000;
  }

  async _login() {
    const { baseUrl, clientId, clientSecret, username, password } = config.sankhya;

    logger.info('[SankhyaAuth] Autenticando via OAuth2 (password grant)...');

    const params = new URLSearchParams({
      grant_type: 'password',
      username,
      password,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await axios.post(
      `${baseUrl}/auth/oauth/token`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          token: config.sankhya.xToken,
          appkey: config.sankhya.appKey,
        },
        timeout: config.sankhya.timeout,
      }
    );

    this._storeTokens(response.data);
    return this._accessToken;
  }

  async _refresh() {
    const { baseUrl, clientId, clientSecret } = config.sankhya;

    logger.info('[SankhyaAuth] Renovando token via refresh_token...');

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this._refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });

      const response = await axios.post(
        `${baseUrl}/auth/oauth/token`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            token: config.sankhya.xToken,
          },
          timeout: config.sankhya.timeout,
        }
      );

      this._storeTokens(response.data);
      return this._accessToken;
    } catch (err) {
      logger.warn('[SankhyaAuth] Refresh falhou, fazendo login completo...');
      this._refreshToken = null;
      return this._login();
    }
  }

  _storeTokens(data) {
    if (!data?.access_token) {
      throw new Error(`[SankhyaAuth] Resposta inesperada: ${JSON.stringify(data)}`);
    }

    this._accessToken = data.access_token;
    this._refreshToken = data.refresh_token || null;

    // expires_in em segundos
    const expiresIn = parseInt(data.expires_in || 3600, 10);
    this._expiresAt = Date.now() + expiresIn * 1000;

    logger.info(`[SankhyaAuth] Token obtido. Expira em ${Math.floor(expiresIn / 60)} min.`);
  }
}

const authManager = new SankhyaAuthManager();
module.exports = authManager;
