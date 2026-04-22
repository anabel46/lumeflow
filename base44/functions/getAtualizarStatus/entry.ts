import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Cole aqui o tokenManager completo (igual ao getDashboard)
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

  const data = await res.json();
  _cachedToken = data.access_token;
  _expiresAt = Date.now() + data.expires_in * 1000;
  return _cachedToken;
}

async function fetchSankhya(url, options = {}) {
  const token = await getValidToken();
  const makeHeaders = (t) => ({
    ...(options.headers || {}),
    "Authorization": `Bearer ${t}`,
    "Content-Type": "application/json",
  });

  const res = await fetch(url, { ...options, headers: makeHeaders(token) });

  if (res.status === 401) {
    _cachedToken = null;
    const fresh = await refreshToken();
    return fetch(url, { ...options, headers: makeHeaders(fresh) });
  }

  return res;
}

// Handler principal
Deno.serve(async (req) => {
  try {
    const { idAtividade, status } = await req.json();

    if (!idAtividade || !status) {
      return Response.json({ erro: "idAtividade e status são obrigatórios" }, { status: 400 });
    }

    const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
    const url = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=CRUDService.saveRecord&outputType=json`;

    const res = await fetchSankhya(url, {
      method: "POST",
      body: JSON.stringify({
        serviceName: "CRUDService.saveRecord",
        requestBody: {
          dataSet: {
            rootEntity: "AtividadeProgramaProducao",
            dataRow: {
              localFields: {
                IDIATV: { $: idAtividade },
                SITUACAO: { $: status }
              }
            },
            entityName: "AtividadeProgramaProducao"
          }
        }
      }),
    });

    const json = await res.json();

    if (String(json.status) !== "1") {
      throw new Error(`Sankhya erro: ${json.statusMessage}`);
    }

    return Response.json({ sucesso: true, mensagem: "Status atualizado!" });

  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});