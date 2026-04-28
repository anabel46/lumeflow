import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Ação 1: Buscar 5 OPs sincronizadas (com production_sequence não vazio)
    const syncedOps = await base44.asServiceRole.entities.ProductionOrder.filter({}, "-updated_date", 5);
    const first5 = syncedOps.filter(op => op.production_sequence && op.production_sequence.length > 0).slice(0, 5);

    const acao1 = first5.map(op => ({
      id: op.id,
      unique_number: op.unique_number,
      order_number: op.order_number,
      production_sequence_value: op.production_sequence,
      production_sequence_type: Array.isArray(op.production_sequence) ? 'array' : typeof op.production_sequence,
      production_sequence_length: Array.isArray(op.production_sequence) ? op.production_sequence.length : 'N/A',
      // Se for array, mostrar cada elemento com seu tipo
      production_sequence_items: Array.isArray(op.production_sequence) 
        ? op.production_sequence.map((item, idx) => ({
            index: idx,
            value: item,
            type: typeof item,
            uppercase: typeof item === 'string' ? item.toUpperCase() : 'N/A',
            lowercase: typeof item === 'string' ? item.toLowerCase() : 'N/A'
          }))
        : null
    }));

    // Ação 2: Buscar a OP-46036 que está confirmada em Expedição
    const op46036 = await base44.asServiceRole.entities.ProductionOrder.filter({ unique_number: "46036" });
    const acao2 = op46036.length > 0 ? {
      id: op46036[0].id,
      unique_number: op46036[0].unique_number,
      order_number: op46036[0].order_number,
      current_sector: op46036[0].current_sector,
      production_sequence_value: op46036[0].production_sequence,
      production_sequence_type: Array.isArray(op46036[0].production_sequence) ? 'array' : typeof op46036[0].production_sequence,
      production_sequence_items: Array.isArray(op46036[0].production_sequence) 
        ? op46036[0].production_sequence.map((item, idx) => ({
            index: idx,
            value: item,
            type: typeof item,
            length: typeof item === 'string' ? item.length : 'N/A',
            uppercase: typeof item === 'string' ? item.toUpperCase() : 'N/A',
            lowercase: typeof item === 'string' ? item.toLowerCase() : 'N/A',
            // Comparação contra possíveis valores
            equals_SEPARACAO: item === 'SEPARACAO',
            equals_Separacao: item === 'Separacao',
            equals_separacao: item === 'separacao',
            equals_Separação: item === 'Separação',
            equals_SEPARAÇÃO: item === 'SEPARAÇÃO',
            includes_SEPAR: typeof item === 'string' && item.toUpperCase().includes('SEPAR'),
          }))
        : null
    } : null;

    // Ação 3: Análise comparativa
    const referenceValue = acao2?.production_sequence_items?.[0];
    const analysis = {
      reference_op: "46036",
      reference_value: referenceValue?.value,
      reference_uppercase: referenceValue?.uppercase,
      synced_ops_total: first5.length,
      synced_values_unique: [...new Set(first5.map(op => JSON.stringify(op.production_sequence)))].map(v => JSON.parse(v)),
      all_synced_values_strings: first5
        .filter(op => Array.isArray(op.production_sequence) && op.production_sequence.length > 0)
        .map(op => ({
          unique_number: op.unique_number,
          first_item: op.production_sequence[0],
          first_item_uppercase: typeof op.production_sequence[0] === 'string' ? op.production_sequence[0].toUpperCase() : 'N/A'
        }))
    };

    return Response.json({
      status: 'success',
      acao_1_primeiras_5_ops: acao1,
      acao_2_op_46036: acao2,
      acao_3_analise: analysis
    });
  } catch (error) {
    console.error('[debugProductionSequence]:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});