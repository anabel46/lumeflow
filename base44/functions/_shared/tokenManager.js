// _shared/tokenManager.js
const MARGIN_MS = 60_000;
let cachedToken = null;
let expiresAt = 0;

/**
 * Retorna um token válido, usando o cache se ainda não expirou.
 */
export async function getValidToken() {
  if (cachedToken && Date.now() < expiresAt - MARGIN_MS) {
    return cachedToken;
  }
  return refreshToken();
}

/**
 * Realiza a autenticação OAuth2 no Sankhya para obter um novo token.
 */
export async function refreshToken() {
  const oauthUrl = Deno.env.get("SANKHYA_OAUTH_URL");
  const clientId = Deno.env.get("SANKHYA_CLIENT_ID");
  const clientSecret = Deno.env.get("SANKHYA_CLIENT_SECRET");
  const xToken = Deno.env.get("SANKHYA_X_TOKEN");

  console.log("🔐 Tentando autenticar no Sankhya...");
  console.log("URL:", oauthUrl);
  console.log("Client ID:", clientId ? "***" + clientId.slice(-3) : "VAZIO");
  console.log("X-Token:", xToken ? "***" + xToken.slice(-3) : "VAZIO");

  if (!oauthUrl || !clientId || !clientSecret || !xToken) {
    throw new Error("Variaveis ausentes no .env");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(oauthUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Token": xToken,
    },
    body: body.toString(),
  });

  console.log("📡 Status da autenticação:", res.status);

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ Falha na autenticação:", text);
    throw new Error(`Auth Sankhya falhou (${res.status}): ${text}`);
  }

  const data = await res.json();
  
  console.log("✅ Token obtido! Expira em:", data.expires_in, "segundos");
  console.log("Token (primeiros 20 chars):", data.access_token?.substring(0, 20) + "...");
  
  cachedToken = data.access_token;
  // Converte expires_in (segundos) para timestamp ms
  expiresAt = Date.now() + data.expires_in * 1000;
  
  return cachedToken;
}

/**
 * Wrapper do fetch que injeta automaticamente o token Bearer e trata erro 401.
 */
export async function fetchSankhya(url, options = {}) {
  const token = await getValidToken();

  const makeHeaders = (t) => ({
    ...(options.headers || {}),
    "Authorization": `Bearer ${t}`,
    "Content-Type": "application/json",
  });

  let res = await fetch(url, { 
    ...options, 
    headers: makeHeaders(token) 
  });

  // Se o token estiver expirado no servidor (401), tenta renovar uma vez
  if (res.status === 401) {
    console.log("401 recebido — renovando token...");
    cachedToken = null;
    const fresh = await refreshToken();
    res = await fetch(url, { 
      ...options, 
      headers: makeHeaders(fresh) 
    });
  }

  return res;
}