// _shared/tokenManager.ts
const MARGIN_MS = 60_000;
let cachedToken: string | null = null;
let expiresAt = 0;

export async function getValidToken(): Promise<string> {
  if (cachedToken && Date.now() < expiresAt - MARGIN_MS) return cachedToken;
  return refreshToken();
}

// _shared/tokenManager.ts - ADICIONAR LOGS

export async function refreshToken(): Promise<string> {
  const oauthUrl     = Deno.env.get("SANKHYA_OAUTH_URL");
  const clientId     = Deno.env.get("SANKHYA_CLIENT_ID");
  const clientSecret = Deno.env.get("SANKHYA_CLIENT_SECRET");
  const xToken       = Deno.env.get("SANKHYA_X_TOKEN");

  console.log("🔐 Tentando autenticar no Sankhya...");
  console.log("URL:", oauthUrl);
  console.log("Client ID:", clientId ? "***" + clientId.slice(-3) : "VAZIO");
  console.log("X-Token:", xToken ? "***" + xToken.slice(-3) : "VAZIO");

  if (!oauthUrl || !clientId || !clientSecret || !xToken) {
    throw new Error("Variaveis ausentes no .env");
  }

  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(oauthUrl, {
    method:  "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Token":      xToken,
    },
    body: body.toString(),
  });

  console.log("📡 Status da autenticação:", res.status);

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ Falha na autenticação:", text);
    throw new Error(`Auth Sankhya falhou (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  
  console.log("✅ Token obtido! Expira em:", data.expires_in, "segundos");
  console.log("Token (primeiros 20 chars):", data.access_token?.substring(0, 20) + "...");
  
  cachedToken = data.access_token;
  expiresAt   = Date.now() + data.expires_in * 1000;
  
  return cachedToken;
}

export async function fetchSankhya(url: string, options: RequestInit): Promise<Response> {
  const token = await getValidToken();

  const makeHeaders = (t: string): Record<string, string> => ({
    ...(options.headers as Record<string, string> ?? {}),
    "Authorization": `Bearer ${t}`,
    "Content-Type":  "application/json",
  });

  const res = await fetch(url, { ...options, headers: makeHeaders(token) });

  if (res.status === 401) {
    console.log("401 recebido — renovando token...");
    cachedToken = null;
    const fresh = await refreshToken();
    return fetch(url, { ...options, headers: makeHeaders(fresh) });
  }

  return res;
}