import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Token Manager ────────────────────────────────────────────────────────────
const MARGIN_MS = 60_000;
let _cachedToken = null;
let _expiresAt = 0;

async function getValidToken() {
  if (_cachedToken && Date.now() < _expiresAt - MARGIN_MS) {
    return _cachedToken;
  }
  return refreshToken();
}

async function refreshToken() {
  const oauthUrl = Deno.env.get("SANKHYA_OAUTH_URL");
  const clientId = Deno.env.get("SANKHYA_CLIENT_ID");
  const clientSecret = Deno.env.get("SANKHYA_CLIENT_SECRET");
  const xToken = Deno.env.get("SANKHYA_X_TOKEN");

  if (!oauthUrl || !clientId || !clientSecret || !xToken) {
    throw new Error("Variáveis Sankhya ausentes");
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth Sankhya falhou (${res.status}): ${text}`);
  }

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

  let res = await fetch(url, { 
    ...options, 
    headers: makeHeaders(token) 
  });

  if (res.status === 401) {
    _cachedToken = null;
    const fresh = await refreshToken();
    res = await fetch(url, { 
      ...options, 
      headers: makeHeaders(fresh) 
    });
  }

  return res;
}

// ── SQL Query idêntica ao getDashboard ───────────────────────────────────────
const SQL_OPERACOES = `SELECT
    COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO,
    P.IDIPROC,
    P.STATUSPROC AS SITUACAO_GERAL,
    A.IDIATV,
    A.IDEFX,
    CASE
        WHEN A.DHACEITE IS NULL THEN 'Aguardando aceite'
        WHEN (SELECT COUNT(1) FROM TPREIATV E WHERE E.IDIATV = A.IDIATV AND E.[TIPO] IN ('P', 'T', 'S') AND E.DHFINAL IS NULL) > 0 THEN 'Em andamento'
        ELSE 'Finalizada'
    END AS SITUACAO_ATIV,
    A.DHINCLUSAO,
    A.DHACEITE,
    A.DHINICIO,
    ITE.CODPROD,
    PRO.DESCRPROD,
    PRO.REFERENCIA
FROM TPRIPROC P
INNER JOIN TPRIATV A ON A.IDIPROC = P.IDIPROC
LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = P.NUNOTA
LEFT JOIN TGFITE ITE ON ITE.NUNOTA = P.NUNOTA
LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
WHERE P.STATUSPROC = 'A'
ORDER BY NUMPEDIDO DESC, P.IDIPROC, A.IDIATV`;

// ── Mapeamento de setores Sankhya → production_sequence ─────────────────────
const SETOR_MAP = {
  "ESTAMPARIA": "estamparia",
  "TORNEARIA": "tornearia",
  "CORTE": "corte",
  "SOLDA": "solda",
  "LIXA": "lixa",
  "REPUXO": "repuxo",
  "PINTURA": "pintura",
  "MONT. DECORATIVA": "montagem_decorativa",
  "MONTAGEM_DECORATIVA": "montagem_decorativa",
  "MONT. ELETRICA": "montagem_eletrica",
  "MONTAGEM_ELETRICA": "montagem_eletrica",
  "MONT. PERFIL": "montagem_perfil",
  "MONTAGEM_PERFIL": "montagem_perfil",
  "MONT. EMBUTIDOS": "montagem_embutidos",
  "MONTAGEM_EMBUTIDOS": "montagem_embutidos",
  "CONTROLE_QUALIDADE": "controle_qualidade",
  "CONTROLE DE QUALIDADE": "controle_qualidade",
  "EMBALAGEM": "embalagem",
  "SEPARACAO": "SEPARACAO",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log("🔄 Buscando sequências de produção do Sankhya...");

    // 1. Buscar sequências do Sankhya
    const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
    if (!baseUrl) throw new Error("SANKHYA_BASE_URL não configurada");

    const url = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;
    const res = await fetchSankhya(url, {
      method: "POST",
      body: JSON.stringify({
        serviceName: "DbExplorerSP.executeQuery",
        requestBody: { sql: SQL_OPERACOES },
      }),
    });

    const json = await res.json();
    if (String(json.status) !== "1") {
      throw new Error(`Sankhya erro: ${json.statusMessage}`);
    }

    // 2. Converter resposta em mapa opId → [atividades]
    // Usamos IDIATV como identifier da atividade (é a descrição em Sankhya)
    const sequenciasPorOp = {};
    const rows = json.responseBody?.rows || [];
    const meta = json.responseBody?.fieldsMetadata || [];

    const colIndex = {};
    for (let i = 0; i < meta.length; i++) {
      colIndex[meta[i].name.toUpperCase()] = i;
    }

    for (const row of rows) {
      const opId = getString(row, colIndex, "IDIPROC");
      const atividade = getString(row, colIndex, "IDIATV");

      if (!opId || !atividade) continue;

      if (!sequenciasPorOp[opId]) {
        sequenciasPorOp[opId] = [];
      }

      // Aqui IDIATV é um ID/descrição que serve como atividade
      // Mapeamos para os setores conhecidos
      const setorMapeado = SETOR_MAP[atividade.toUpperCase()] || atividade.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      if (!sequenciasPorOp[opId].includes(setorMapeado)) {
        sequenciasPorOp[opId].push(setorMapeado);
      }
    }

    console.log(`✅ Sankhya retornou ${Object.keys(sequenciasPorOp).length} OPs com sequências`);

    // 3. Atualizar OPs no Base44 que estão vazias
    const allOps = await base44.asServiceRole.entities.ProductionOrder.list("-created_date", 9999);

    let atualizadas = 0;
    let puladas = 0;
    const erros = [];

    for (const op of allOps) {
      try {
        // Se já tem production_sequence preenchida, pular
        if (op.production_sequence && Array.isArray(op.production_sequence) && op.production_sequence.length > 0) {
          puladas++;
          continue;
        }

        // Tentar encontrar a sequência no Sankhya usando unique_number
        let sequencia = null;

        // Extrair ID da OP (ex: "46036" de "46036")
        const opIdFromUnique = op.unique_number?.replace(/[^\d]/g, "");

        if (opIdFromUnique && sequenciasPorOp[opIdFromUnique]) {
          sequencia = sequenciasPorOp[opIdFromUnique];
        }

        // Se encontrou sequência, atualizar
        if (sequencia && sequencia.length > 0) {
          await base44.asServiceRole.entities.ProductionOrder.update(op.id, {
            production_sequence: sequencia,
          });
          atualizadas++;
        }
      } catch (error) {
        erros.push({
          op_id: op.id,
          unique_number: op.unique_number,
          error: error.message
        });
      }
    }

    console.log(`📊 Sync concluído: ${atualizadas} atualizadas, ${puladas} puladas, ${erros.length} erros`);

    return Response.json({
      status: 'success',
      summary: {
        total_verificadas: allOps.length,
        total_atualizadas: atualizadas,
        total_puladas: puladas,
        erros: erros.length,
        erros_detalhes: erros.length > 0 ? erros : null
      }
    });
  } catch (error) {
    console.error('[syncProductionSequenceFromSankhya]:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function getNode(row, idx, col) {
  const i = idx[col.toUpperCase()];
  return (i !== undefined && i < row.length) ? row[i] : null;
}

function getString(row, idx, col) {
  const v = getNode(row, idx, col);
  return (v == null) ? "" : String(v).trim();
}