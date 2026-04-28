import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar TODAS as OPs
    const allOps = await base44.asServiceRole.entities.ProductionOrder.list("-created_date", 9999);

    let comSequencia = 0;
    let semSequencia = 0;
    const exemplosVazios = [];

    for (const op of allOps) {
      const temSequencia = op.production_sequence && Array.isArray(op.production_sequence) && op.production_sequence.length > 0;
      
      if (temSequencia) {
        comSequencia++;
      } else {
        semSequencia++;
        // Pegar 3 exemplos
        if (exemplosVazios.length < 3) {
          exemplosVazios.push({
            id: op.id,
            unique_number: op.unique_number,
            order_number: op.order_number,
            product_name: op.product_name,
            quantity: op.quantity,
            status: op.status,
            current_sector: op.current_sector,
            production_sequence: op.production_sequence,
            reference: op.reference
          });
        }
      }
    }

    return Response.json({
      status: 'success',
      diagnostico: {
        total_ops: allOps.length,
        com_production_sequence: comSequencia,
        sem_production_sequence: semSequencia,
        percentual_preenchido: Math.round((comSequencia / allOps.length) * 100),
        exemplos_vazios: exemplosVazios
      }
    });
  } catch (error) {
    console.error('[diagnosticProductionSequence]:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});