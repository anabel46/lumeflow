import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MARGIN_MS = 60_000;
let _cachedToken = null;
let _expiresAt = 0;

async function getValidToken() {
  if (_cachedToken && Date.now() < _expiresAt - MARGIN_MS) return _cachedToken;
  return refreshToken();
}

async function refreshToken() {
  const oauthUrl = Deno.env.get("SANKHYA_OAUTH_URL");
  const clientId = Deno.env.get("SANKHYA_CLIENT_ID");
  const clientSecret = Deno.env.get("SANKHYA_CLIENT_SECRET");
  const xToken = Deno.env.get("SANKHYA_X_TOKEN");
  if (!oauthUrl || !clientId || !clientSecret || !xToken)
    throw new Error("Variáveis Sankhya ausentes");

  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret });
  const res = await fetch(oauthUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Token": xToken },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Auth Sankhya falhou: ${await res.text()}`);
  const data = await res.json();
  _cachedToken = data.access_token;
  _expiresAt = Date.now() + data.expires_in * 1000;
  return _cachedToken;
}

async function fetchSankhya(url, options = {}) {
  const token = await getValidToken();
  const makeHeaders = (t) => ({ ...(options.headers || {}), "Authorization": `Bearer ${t}`, "Content-Type": "application/json" });
  let res = await fetch(url, { ...options, headers: makeHeaders(token) });
  if (res.status === 401) { _cachedToken = null; res = await fetch(url, { ...options, headers: makeHeaders(await refreshToken()) }); }
  return res;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const { sql } = await req.json();
    if (!sql || typeof sql !== 'string') return Response.json({ error: 'SQL inválido' }, { status: 400 });

    const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
    const urlSankhya = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

    const res = await fetchSankhya(urlSankhya, {
      method: "POST",
      body: JSON.stringify({ serviceName: "DbExplorerSP.executeQuery", requestBody: { sql } }),
    });

    const json = await res.json();
    if (String(json.status) !== "1") throw new Error(json.statusMessage || "Erro ao executar query");

    const meta = json.responseBody?.fieldsMetadata || [];
    const rows = json.responseBody?.rows || [];

    const columns = meta.map(m => m.name);
    const data = rows.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i] !== null && row[i] !== undefined ? String(row[i]) : ""; });
      return obj;
    });

    return Response.json({ columns, data, total: data.length });
  } catch (error) {
    console.error("❌ sankhyaExplorer:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});