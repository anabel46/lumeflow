import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    const { event, data } = payload;
    
    if (!data || !event) {
      return Response.json({ error: 'Payload inválido' }, { status: 400 });
    }

    const po = data;
    
    // Verificar se a OP possui APENAS "SEPARACAO" na sequência
    const hasOnlySeparacao = 
      po.production_sequence && 
      Array.isArray(po.production_sequence) &&
      po.production_sequence.length === 1 &&
      po.production_sequence[0].toUpperCase() === "SEPARACAO";

    if (!hasOnlySeparacao) {
      return Response.json({ status: 'skip', reason: 'OP não possui apenas SEPARACAO' });
    }

    // Buscar OP duplicada existente em expedição
    const existingDuplicate = await base44.asServiceRole.entities.ProductionOrder.filter({
      unique_number: po.unique_number,
      current_sector: "expedicao"
    });

    if (event.type === 'create' || event.type === 'update') {
      if (hasOnlySeparacao && existingDuplicate.length === 0) {
        // Duplicar para Expedição
        const duplicateData = {
          unique_number: po.unique_number,
          order_id: po.order_id,
          order_number: po.order_number,
          product_id: po.product_id,
          reference: po.reference,
          product_name: po.product_name,
          complement: po.complement,
          control: po.control,
          color: po.color,
          quantity: po.quantity,
          cost_center: po.cost_center,
          request_date: po.request_date,
          environment: po.environment,
          purchase_location: po.purchase_location,
          observations: po.observations,
          technical_drawing_url: po.technical_drawing_url,
          production_sequence: po.production_sequence,
          current_sector: "expedicao",
          current_step_index: po.current_step_index,
          sector_status: po.sector_status,
          status: po.status,
          delivery_deadline: po.delivery_deadline,
          is_intermediate: po.is_intermediate,
          parent_order_id: po.parent_order_id,
        };
        
        await base44.asServiceRole.entities.ProductionOrder.create(duplicateData);
        return Response.json({ status: 'created', message: 'OP duplicada para Expedição' });
      }
    }

    // Se a OP tiver mais processos além de SEPARACAO, remover duplicata de expedição
    if (event.type === 'update' && !hasOnlySeparacao && existingDuplicate.length > 0) {
      for (const dup of existingDuplicate) {
        await base44.asServiceRole.entities.ProductionOrder.delete(dup.id);
      }
      return Response.json({ status: 'deleted', message: 'Duplicata removida de Expedição' });
    }

    return Response.json({ status: 'ok' });
  } catch (error) {
    console.error('[handleSeparacaoOnlyOP]:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});