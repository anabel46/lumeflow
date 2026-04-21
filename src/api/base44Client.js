import { createClient } from '@base44/sdk';
import { appParams } from '../lib/app-params.js';

const { appId, functionsVersion, appBaseUrl } = appParams;

// Lê o token dinamicamente a cada chamada,
// garantindo que o token pós-login seja sempre usado.
const getToken = () => {
  const fromStorage = localStorage.getItem('base44_access_token')
    || localStorage.getItem('token');
  return fromStorage || appParams.token;
};

export const base44 = createClient({
  appId,
  functionsVersion,
  appBaseUrl,
  serverUrl: '',
  requiresAuth: true,
  tokenProvider: getToken, // ← token dinâmico, não estático
});