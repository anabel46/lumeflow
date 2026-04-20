# Integração Sankhya — Guia de Configuração

## Variáveis de Ambiente

Configure estas variáveis em **Settings > Environment** no painel do Base44.  
Como o app roda no browser (Vite), todas têm o prefixo `VITE_`.

| Variável                     | Descrição                                      | Exemplo                                      |
|------------------------------|------------------------------------------------|----------------------------------------------|
| `VITE_SANKHYA_OAUTH_URL`     | URL do endpoint OAuth2 do Sankhya              | `https://api.sankhya.com.br/oauth/token`     |
| `VITE_SANKHYA_CLIENT_ID`     | Client ID do aplicativo Sankhya                | `c7aded48-eee0-4187-8ee1-26fa40b0f52b`       |
| `VITE_SANKHYA_CLIENT_SECRET` | Client Secret do aplicativo Sankhya            | `0z8eDmAr8iTxZcaRl3DasbQaBiSetV3W`          |
| `VITE_SANKHYA_X_TOKEN`       | X-Token adicional (se necessário pela API)     | `0ec8c781-945f-4702-99d8-c634ae6fcf76`       |
| `VITE_SANKHYA_BASE_URL`      | URL base da API Sankhya (sem barra no final)   | `https://api.sankhya.com.br`                 |

---

## Como obter as credenciais no Sankhya

1. **Acesse o portal de parceiros/desenvolvedor** do Sankhya:  
   `https://developer.sankhya.com.br`

2. **Crie ou acesse seu aplicativo** (App) na seção de integrações.

3. Copie os valores de:
   - **Client ID** → `VITE_SANKHYA_CLIENT_ID`
   - **Client Secret** → `VITE_SANKHYA_CLIENT_SECRET`
   - **X-Token** (token de aplicação, se exigido) → `VITE_SANKHYA_X_TOKEN`

4. O **OAUTH_URL** segue o padrão:
   - Sandbox: `https://api.sandbox.sankhya.com.br/oauth/token`
   - Produção: `https://api.sankhya.com.br/oauth/token`

5. O **BASE_URL** é o host da API sem trailing slash:
   - Produção: `https://api.sankhya.com.br`

---

## Fluxo OAuth2

```
Client → POST VITE_SANKHYA_OAUTH_URL
         body: grant_type=client_credentials&client_id=...&client_secret=...
         header: X-Token: ...
       ← { access_token, expires_in, token_type }

Client → POST BASE_URL/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery
         header: Authorization: Bearer {access_token}
         body: { serviceName, requestBody: { sql } }
       ← { status: "1", responseBody: { rows, fieldsMetadata } }
```

O token é cacheado em memória com margem de 60 segundos antes do vencimento.  
Em caso de `401`, o token é descartado e renovado automaticamente (1 retry).

---

## Como testar a conexão

### 1. Via console do browser

Abra o console (F12) em qualquer página do app e execute:

```js
import { getDashboard } from '/src/integrations/sankhya.js';
getDashboard().then(console.log).catch(console.error);
```

### 2. Verificar variáveis configuradas

```js
console.log({
  oauth: import.meta.env.VITE_SANKHYA_OAUTH_URL,
  base: import.meta.env.VITE_SANKHYA_BASE_URL,
  clientId: import.meta.env.VITE_SANKHYA_CLIENT_ID ? '✅ configurado' : '❌ ausente',
  clientSecret: import.meta.env.VITE_SANKHYA_CLIENT_SECRET ? '✅ configurado' : '❌ ausente',
  xToken: import.meta.env.VITE_SANKHYA_X_TOKEN ? '✅ configurado' : '❌ ausente',
});
```

### 3. Erro comum: CORS

A API Sankhya pode bloquear requisições diretas do browser.  
Nesse caso, a solução é criar um **backend function** no Base44 que faz o proxy das chamadas.  
O arquivo `src/integrations/sankhya.js` pode então chamar `base44.functions.invoke('sankhyaProxy', { sql })`.

---

## Funções disponíveis

| Função                          | Descrição                                              |
|---------------------------------|--------------------------------------------------------|
| `getSankhyaOps()`               | Lista flat de todas as OPs ativas                      |
| `getOpsPorPedido()`             | OPs agrupadas por NUMPEDIDO → IDIPROC                 |
| `getOp(idiproc)`                | Atividades de uma OP específica                        |
| `getDashboard()`                | Totais: OPs, situações, aguardando aceite              |
| `atualizarStatus(idiproc, st)`  | Atualiza STATUSPROC (ex: 'A' ativo, 'F' finalizado)   |

## Hook React

```jsx
import { useSankhya } from '@/hooks/useSankhya';

function MeuComponente() {
  const { ops, dashboard, loading, error, fetchOps } = useSankhya();
  // ...
}
``