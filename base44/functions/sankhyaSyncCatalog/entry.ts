import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Token Manager ─────────────────────────────────────────────────────────────
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
    throw new Error("Variáveis Sankhya ausentes no .env");
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret });
  const res = await fetch(oauthUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Token": xToken }, body: body.toString() });
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLong(row, idx, col) {
  const v = row[idx[col.toUpperCase()]];
  if (v === undefined || v === null || v === "") return null;
  return Number(String(v).replace(/\D/g, ""));
}
function getString(row, idx, col) {
  const v = row[idx[col.toUpperCase()]];
  return v !== undefined && v !== null ? String(v).trim() : "";
}
function buildIdx(meta) {
  const idx = {};
  meta.forEach((m, i) => { idx[m.name.toUpperCase()] = i; });
  return idx;
}

// ── SQL: composição (BOM) por produto ─────────────────────────────────────────
const SQL_BOM = `
SELECT
    E.CODPROD       AS CODPROD_PAI,
    PAI.DESCRPROD   AS DESCR_PAI,
    PAI.REFERENCIA  AS REF_PAI,
    E.CODPRODFI     AS CODPROD_COMP,
    COMP.DESCRPROD  AS DESCR_COMP,
    COMP.REFERENCIA AS REF_COMP,
    COMP.TIPOPROD   AS TIPO_COMP,
    E.QTDNEC        AS QTD_NECESSARIA,
    E.PERDAPREV     AS PERDA_PREV,
    E.SEQITEM       AS SEQUENCIA
FROM TGFEST E
INNER JOIN TGFPRO PAI  ON PAI.CODPROD  = E.CODPROD
INNER JOIN TGFPRO COMP ON COMP.CODPROD = E.CODPRODFI
ORDER BY E.CODPROD, E.SEQITEM`;

// ── SQL: processo produtivo (fluxo) por referência ────────────────────────────
const SQL_FLUXO_PRODUTO = `
SELECT DISTINCT
    PRO.CODPROD,
    PRO.REFERENCIA,
    PRO.DESCRPROD,
    A.IDEFX,
    A.IDIATV,
    FX.DESCRICAO    AS DESCRICAO_FX
FROM TPRIPROC P
INNER JOIN TPRIATV A   ON A.IDIPROC  = P.IDIPROC
LEFT  JOIN TPREFX  FX  ON FX.IDEFX   = A.IDEFX
LEFT  JOIN (
    SELECT NUNOTA, MIN(CODPROD) AS CODPROD
    FROM TGFITE
    GROUP BY NUNOTA
) ITE ON ITE.NUNOTA = P.NUNOTA
LEFT  JOIN TGFPRO  PRO ON PRO.CODPROD = ITE.CODPROD
WHERE A.IDEFX IS NOT NULL
ORDER BY PRO.REFERENCIA, A.IDIATV`;

// ── Mapeamento de descrição Sankhya → enum LumeFlow ──────────────────────────
const SETOR_MAP = {
  "ESTAMPARIA": "estamparia", "TORNEARIA": "tornearia", "CORTE": "corte",
  "SOLDA": "solda", "LIXA": "lixa", "REPUXO": "repuxo", "PINTURA": "pintura",
  "MONTAGEM DECORATIVA": "montagem_decorativa", "MONTAGEM ELETRICA": "montagem_eletrica",
  "MONTAGEM ELÉTRICA": "montagem_eletrica", "MONTAGEM PERFIL": "montagem_perfil",
  "MONTAGEM EMBUTIDOS": "montagem_embutidos", "CONTROLE QUALIDADE": "controle_qualidade",
  "CONTROLE DE QUALIDADE": "controle_qualidade", "EMBALAGEM": "embalagem",
};

// ── Main Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const baseUrl    = Deno.env.get("SANKHYA_BASE_URL");
    const urlSankhya = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

    const callSankhya = (sql) =>
      fetchSankhya(urlSankhya, {
        method: "POST",
        body: JSON.stringify({ serviceName: "DbExplorerSP.executeQuery", requestBody: { sql } }),
      }).then(r => r.json());

    // Executa BOM e fluxo em paralelo
    const [bomRaw, fluxoRaw] = await Promise.all([
      callSankhya(SQL_BOM),
      callSankhya(SQL_FLUXO_PRODUTO),
    ]);

    // ── Processa BOM ──────────────────────────────────────────────────────────
    const bomPorRef = {};
    if (String(bomRaw.status) === "1" && bomRaw.responseBody?.rows) {
      const idx = buildIdx(bomRaw.responseBody.fieldsMetadata);
      for (const row of bomRaw.responseBody.rows) {
        const ref = getString(row, idx, "REF_PAI");
        if (!ref) continue;
        if (!bomPorRef[ref]) bomPorRef[ref] = [];
        bomPorRef[ref].push({
          product_id:        getString(row, idx, "CODPROD_COMP"),
          reference:         getString(row, idx, "REF_COMP"),
          name:              getString(row, idx, "DESCR_COMP"),
          tipo:              getString(row, idx, "TIPO_COMP"),
          quantity_per_unit: getLong(row, idx, "QTD_NECESSARIA") || 1,
          perda_prev:        getLong(row, idx, "PERDA_PREV") || 0,
          sequencia:         getLong(row, idx, "SEQUENCIA") || 0,
        });
      }
    }

    // ── Processa Fluxo Produtivo ──────────────────────────────────────────────
    const fluxoPorRef = {};
    if (String(fluxoRaw.status) === "1" && fluxoRaw.responseBody?.rows) {
      const idx = buildIdx(fluxoRaw.responseBody.fieldsMetadata);
      for (const row of fluxoRaw.responseBody.rows) {
        const ref    = getString(row, idx, "REFERENCIA");
        const idefx  = getString(row, idx, "IDEFX");
        const idiatv = getLong(row, idx, "IDIATV") || 0;
        const descFx = getString(row, idx, "DESCRICAO_FX").toUpperCase();
        if (!ref || !idefx) continue;
        if (!fluxoPorRef[ref]) fluxoPorRef[ref] = [];
        if (!fluxoPorRef[ref].some(f => f.idefx === idefx)) {
          fluxoPorRef[ref].push({
            idefx,
            idiatv,
            descricao: getString(row, idx, "DESCRICAO_FX"),
            setor:     SETOR_MAP[descFx] || null,
            sequencia: idiatv,
          });
        }
      }
      Object.values(fluxoPorRef).forEach(arr => arr.sort((a, b) => a.idiatv - b.idiatv));
    }

    // ── Consolida resultado ───────────────────────────────────────────────────
    const todasRefs = new Set([...Object.keys(bomPorRef), ...Object.keys(fluxoPorRef)]);
    const resultado = [];

    for (const ref of todasRefs) {
      const bom   = bomPorRef[ref]   || [];
      const fluxo = fluxoPorRef[ref] || [];
      const production_sequence = fluxo
        .filter(f => f.setor)
        .map(f => f.setor)
        .filter((v, i, arr) => arr.indexOf(v) === i);

      resultado.push({
        reference: ref,
        components: bom,
        production_sequence,
        fluxo_detalhado: fluxo,
      });
    }

    return Response.json({
      total:      resultado.length,
      produtos:   resultado,
      refs_bom:   Object.keys(bomPorRef).length,
      refs_fluxo: Object.keys(fluxoPorRef).length,
    });

  } catch (error) {
    console.error("❌ Erro sync catálogo:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});