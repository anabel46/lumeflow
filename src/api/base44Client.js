import { createClient } from '@base44/sdk';
import { appParams } from '../lib/app-params.js'; 

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId,
  token, 
  functionsVersion,
  serverUrl: '', 
  requiresAuth: true, // OBRIGATÓRIO: ativa o crachá de acesso
  appBaseUrl,
  headers: {
    'client_id': 'c7aded48-eee0-4187-8ee1-26fa40b0f52b',
    'client_secret': '0z8eDmAr8iTxZcaRl3DasbQaBiSetV3W',
    'X-Token': '0ec8c781-945f-4702-99d8-c634ae6fcf76',
    'Content-Type': 'application/json'
  }
});