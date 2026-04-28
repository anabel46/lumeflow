import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Fetch Sankhya com X-TOKEN ───────────────────────────────────────────────
async function fetchSankhya(url, options = {}) {
  const xToken = Deno.env.get("SANKHYA_X_TOKEN");
  if (!xToken) {
    throw new Error("SANKHYA_X_TOKEN não configurado");
  }

  const headers = {
    "X-TOKEN": xToken,
    "Content-Type": "application/json",
    ...options.headers,
  };

  return fetch(url, { ...options, headers });
}

// ─── Mapeamento de CODESTR (código setor Sankhya) → production_sequence ──────
const SETOR_MAP = {
  "01": "estamparia",
  "02": "tornearia",
  "03": "corte",
  "04": "solda",
  "05": "lixa",
  "06": "repuxo",
  "07": "pintura",
  "08": "montagem_decorativa",
  "09": "montagem_eletrica",
  "10": "montagem_perfil",
  "11": "montagem_embutidos",
  "12": "controle_qualidade",
  "13": "embalagem",
  "14": "SEPARACAO",
  // Fallback: qualquer outro código → SEPARACAO
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log("🔄 Buscando sequências de produção do Sankhya...");

    // 1. Buscar todas as OPs do Sankhya que ainda não têm production_sequence
    const allOpsInBase = await base44.asServiceRole.entities.ProductionOrder.list("-created_date", 9999);
    const opsWithoutSequence = allOpsInBase.filter(op => !op.production_sequence || op.production_sequence.length === 0);
    
    console.log(`📋 ${opsWithoutSequence.length} OPs sem production_sequence para sincronizar`);

    // 2. Para cada OP, tentar buscar do Sankhya
    let atualizadas = 0;
    const erros = [];

    for (const op of opsWithoutSequence) {
      try {
        // Extrair número do pedido do unique_number
        const opNumber = op.unique_number?.replace(/[^\d]/g, "");
        if (!opNumber) continue;

        // Buscar processo no Sankhya por número da OP
        const baseUrl = Deno.env.get("SANKHYA_BASE_URL");
        if (!baseUrl) throw new Error("SANKHYA_BASE_URL não configurada");

        const sql = `
          SELECT TOP 20 
            IDIPROC, 
            CODESTR, 
            IDIATV
          FROM TPRIPROC
          WHERE IDIPROC = '${opNumber}' AND STATUSPROC = 'A'
          ORDER BY IDIATV
        `;

        const url = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;
        const res = await fetchSankhya(url, {
          method: "POST",
          body: JSON.stringify({
            serviceName: "DbExplorerSP.executeQuery",
            requestBody: { sql },
          }),
        });

        const json = await res.json();
        
        if (String(json.status) !== "1") {
          // Sem dados no Sankhya, usar padrão SEPARACAO
          await base44.asServiceRole.entities.ProductionOrder.update(op.id, {
            production_sequence: ["SEPARACAO"],
          });
          atualizadas++;
          continue;
        }

        // Parse dos setores da resposta
        const rows = json.responseBody?.rows || [];
        const meta = json.responseBody?.fieldsMetadata || [];
        
        const colIndex = {};
        for (let i = 0; i < meta.length; i++) {
          colIndex[meta[i].name.toUpperCase()] = i;
        }

        // Extrair setores únicos
        const setoresUnicos = [];
        for (const row of rows) {
          const codestr = row[colIndex["CODESTR"]] ? String(row[colIndex["CODESTR"]]).trim() : "";
          if (codestr) {
            const setorMapeado = SETOR_MAP[codestr] || "SEPARACAO";
            if (!setoresUnicos.includes(setorMapeado)) {
              setoresUnicos.push(setorMapeado);
            }
          }
        }

        // Se vazio, usar padrão
        const sequencia = setoresUnicos.length > 0 ? setoresUnicos : ["SEPARACAO"];

        await base44.asServiceRole.entities.ProductionOrder.update(op.id, {
          production_sequence: sequencia,
        });
        atualizadas++;
      } catch (error) {
        erros.push({
          op_id: op.id,
          unique_number: op.unique_number,
          error: error.message
        });
      }
    }

    console.log(`📊 Sync concluído: ${atualizadas} atualizadas, ${erros.length} erros`);

    return Response.json({
      status: 'success',
      summary: {
        total_verificadas: opsWithoutSequence.length,
        total_atualizadas: atualizadas,
        erros: erros.length,
        erros_detalhes: erros.length > 0 ? erros.slice(0, 10) : null
      }
    });
  } catch (error) {
    console.error('[syncProductionSequenceFromSankhya]:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});