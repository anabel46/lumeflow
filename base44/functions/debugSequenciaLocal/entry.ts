import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar 10 OPs com production_sequence
    const ops = await base44.asServiceRole.entities.ProductionOrder.filter({}, "-updated_date", 10);
    const withSeq = ops.filter(op => op.production_sequence && op.production_sequence.length > 0);

    const result = {
      total: withSeq.length,
      ejemplos: withSeq.slice(0, 5).map(op => ({
        unique_number: op.unique_number,
        production_sequence: op.production_sequence,
        first_item: op.production_sequence[0],
        length: op.production_sequence.length
      })),
      // Análisis: cuáles tienen solo SEPARACAO?
      only_separacao: withSeq.filter(op => op.production_sequence.length === 1 && op.production_sequence[0] === "SEPARACAO").length,
      // Cuáles tienen solo números?
      only_numbers: withSeq.filter(op => /^\d+$/.test(op.production_sequence[0])).length,
      // Valores únicos del primer item
      unique_first_items: [...new Set(withSeq.map(op => op.production_sequence[0]))]
    };

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});