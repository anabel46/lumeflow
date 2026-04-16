import { createClient } from '@base44/sdk';
import { appParams } from '../lib/app-params.js'; // Garanta o .js aqui também

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Log para você conferir se o token está sendo lido (olhe no Console do navegador)
console.log("AppId:", appId, "Token presente:", !!token);

export const base44 = createClient({
  appId,
  token, // Este valor precisa estar configurado no painel do Base44
  functionsVersion,
  serverUrl: '', 
  requiresAuth: true, // Mude para true para enviar o Header de autorização
  appBaseUrl
});