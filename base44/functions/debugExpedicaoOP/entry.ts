import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar OPs em Expedição
    const expedicaoOps = await base44.asServiceRole.entities.ProductionOrder.filter({ 
      current_sector: "expedicao" 
    }, "-created_date", 10);

    const result = {
      total_in_expedicao: expedicaoOps.length,
      ops: expedicaoOps.map(op => ({
        id: op.id,
        unique_number: op.unique_number,
        order_number: op.order_number,
        current_sector: op.current_sector,
        production_sequence_value: op.production_sequence,
        production_sequence_type: Array.isArray(op.production_sequence) ? 'array' : typeof op.production_sequence,
        production_sequence_length: Array.isArray(op.production_sequence) ? op.production_sequence.length : 'N/A',
        production_sequence_items: Array.isArray(op.production_sequence) 
          ? op.production_sequence.map((item, idx) => ({
              index: idx,
              value: item,
              type: typeof item,
            }))
          : null,
        // Se houver apenas 1 item, checamos o que é
        has_only_one_item: Array.isArray(op.production_sequence) && op.production_sequence.length === 1,
        first_item: Array.isArray(op.production_sequence) && op.production_sequence.length > 0 ? op.production_sequence[0] : null
      }))
    };

    return Response.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('[debugExpedicaoOP]:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});