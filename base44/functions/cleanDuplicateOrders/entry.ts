import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log("🧹 Iniciando limpeza de duplicatas...");

    // 1. Buscar todas as ProductionOrder
    const allRecords = await base44.asServiceRole.entities.ProductionOrder.list("-created_date", 2000);
    console.log(`📊 Total de registros encontrados: ${allRecords.length}`);

    // 2. Agrupar por unique_number
    const grouped = {};
    allRecords.forEach(record => {
      const key = record.unique_number;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(record);
    });

    const detalhes = [];
    let totalAnalisadas = allRecords.length;
    let gruposComDuplicata = 0;
    let registrosDeletados = 0;

    // 3. Para cada grupo com duplicatas
    for (const [uniqueNumber, records] of Object.entries(grouped)) {
      if (records.length > 1) {
        gruposComDuplicata++;
        console.log(`⚠️ OP ${uniqueNumber}: ${records.length} registros encontrados`);

        // Identificar o registro mais completo/recente
        const sorted = records.sort((a, b) => {
          // Contar campos preenchidos
          const countA = Object.values(a).filter(v => v && v !== "").length;
          const countB = Object.values(b).filter(v => v && v !== "").length;
          if (countA !== countB) return countB - countA;

          // Se tiver mesmo número de campos, usar o mais recente
          const dateA = new Date(a.created_date || "1970-01-01").getTime();
          const dateB = new Date(b.created_date || "1970-01-01").getTime();
          return dateB - dateA;
        });

        const manter = sorted[0];
        const deletarList = sorted.slice(1);

        detalhes.push({
          unique_number: uniqueNumber,
          total_encontrados: records.length,
          mantido: manter.id,
          deletados: deletarList.map(r => r.id),
        });

        // Deletar os demais
        for (const record of deletarList) {
          try {
            await base44.asServiceRole.entities.ProductionOrder.delete(record.id);
            registrosDeletados++;
            console.log(`  🗑️ Deletado: ${record.id}`);
          } catch (err) {
            console.error(`  ❌ Erro ao deletar ${record.id}: ${err.message}`);
          }
        }
      }
    }

    console.log(`✅ Limpeza concluída: ${registrosDeletados} registros deletados`);

    return Response.json({
      success: true,
      message: `Limpeza concluída: ${registrosDeletados} duplicatas removidas de ${gruposComDuplicata} OPs`,
      total_analisadas: totalAnalisadas,
      grupos_com_duplicata: gruposComDuplicata,
      registros_deletados: registrosDeletados,
      detalhes: detalhes.slice(0, 50),
    });
  } catch (error) {
    console.error("❌ Erro na limpeza:", error.message);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
});