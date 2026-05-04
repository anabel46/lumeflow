import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function retryOnRateLimit(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err.message?.includes('Rate limit') || err.status === 429;
      if (!isRateLimit || attempt === maxRetries - 1) throw err;
      console.warn(`⚠️ Rate limit — aguardando 3s antes da tentativa ${attempt + 2}...`);
      await sleep(3000);
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    console.log('🔄 Iniciando reconstrução de Order a partir de ProductionOrder...');

    // ── PASSO 1: Ler todos os ProductionOrder e agrupar por order_number ──────
    console.log('📦 PASSO 1: Lendo ProductionOrder...');
    const allPOs = await base44.asServiceRole.entities.ProductionOrder.list('-created_date', 9999);
    
    const posByOrderNumber = {};
    let skipped = 0;

    for (const po of allPOs) {
      const orderNum = po.order_number?.trim();
      if (!orderNum) {
        skipped++;
        continue;
      }
      if (!posByOrderNumber[orderNum]) {
        posByOrderNumber[orderNum] = [];
      }
      posByOrderNumber[orderNum].push(po);
    }

    const uniqueOrderNumbers = Object.keys(posByOrderNumber);
    console.log(`✅ Lidos ${allPOs.length} ProductionOrder | ${uniqueOrderNumbers.length} order_numbers únicos | ${skipped} ignorados`);

    // ── PASSO 2: Deletar todos os Order ────────────────────────────────────────
    console.log('🗑️ PASSO 2: Deletando Order existentes...');
    const allOrders = await base44.asServiceRole.entities.Order.list('-created_date', 9999);
    let deletedCount = 0;
    let deleteErrors = 0;

    for (let i = 0; i < allOrders.length; i++) {
      const order = allOrders[i];
      try {
        await retryOnRateLimit(() => base44.asServiceRole.entities.Order.delete(order.id));
        deletedCount++;
        console.log(`  [${i + 1}/${allOrders.length}] Deletado #${order.order_number}`);
      } catch (err) {
        console.error(`  ❌ Erro ao deletar #${order.order_number}:`, err.message);
        deleteErrors++;
      }
      await sleep(200);
    }
    console.log(`✅ Deletados ${deletedCount} Order | ${deleteErrors} erros`);

    // ── PASSO 3: Recriar Order a partir de ProductionOrder ─────────────────────
    console.log('📝 PASSO 3: Recriando Order...');
    let createdCount = 0;
    let createErrors = 0;

    for (let idx = 0; idx < uniqueOrderNumbers.length; idx++) {
      const orderNumber = uniqueOrderNumbers[idx];
      const posForThisOrder = posByOrderNumber[orderNumber];

      try {
        // Determinar status: em_producao > finalizado > planejamento
        let status = 'planejamento';
        if (posForThisOrder.some(po => po.status === 'em_producao')) {
          status = 'em_producao';
        } else if (posForThisOrder.every(po => po.status === 'finalizado')) {
          status = 'finalizado';
        }

        // Buscar datas mínimas
        const validRequestDates = posForThisOrder
          .map(po => po.request_date)
          .filter(d => d);
        const validDeliveryDeadlines = posForThisOrder
          .map(po => po.delivery_deadline)
          .filter(d => d);

        const minRequestDate = validRequestDates.length > 0
          ? new Date(Math.min(...validRequestDates.map(d => new Date(d).getTime()))).toISOString().split('T')[0]
          : null;

        const minDeliveryDeadline = validDeliveryDeadlines.length > 0
          ? new Date(Math.min(...validDeliveryDeadlines.map(d => new Date(d).getTime()))).toISOString().split('T')[0]
          : null;

        // Observações: product_name da primeira OP
        const observations = posForThisOrder[0]?.product_name || '';

        const newOrder = {
          order_number: orderNumber,
          sankhya_id: orderNumber,
          client_name: 'FÁBRICA',
          status,
          delivery_type: 'normal',
          request_date: minRequestDate,
          delivery_deadline: minDeliveryDeadline,
          observations,
        };

        await retryOnRateLimit(() => base44.asServiceRole.entities.Order.create(newOrder));
        createdCount++;
        console.log(`  [${idx + 1}/${uniqueOrderNumbers.length}] Criado #${orderNumber} (${posForThisOrder.length} OPs, status=${status})`);
      } catch (err) {
        console.error(`  ❌ Erro ao criar #${orderNumber}:`, err.message);
        createErrors++;
      }
      await sleep(200);
    }
    console.log(`✅ Criados ${createdCount} Order | ${createErrors} erros`);

    // ── PASSO 4: Retornar relatório ──────────────────────────────────────────────
    const report = {
      success: true,
      deleted: deletedCount,
      created: createdCount,
      skipped,
      errors: deleteErrors + createErrors,
      summary: `Reconstrução concluída: ${createdCount} Order criados a partir de ${uniqueOrderNumbers.length} order_numbers únicos`,
    };

    console.log('✅', report.summary);
    return Response.json(report);

  } catch (error) {
    console.error('❌ Erro rebuildOrdersFromProduction:', error.message);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});