import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar todas as OPs ativas
    const allOps = await base44.asServiceRole.entities.ProductionOrder.list();

    let processados = 0;
    let duplicados = 0;
    let pulados = 0;
    const erros = [];

    for (const op of allOps) {
      try {
        // Validar condições
        if (op.status === 'finalizado' || op.status === 'cancelado') {
          pulados++;
          continue;
        }

        // Verificar se tem APENAS SEPARACAO
        const hasOnlySeparacao = 
          op.production_sequence && 
          Array.isArray(op.production_sequence) &&
          op.production_sequence.length === 1 &&
          op.production_sequence[0].toUpperCase() === "SEPARACAO";

        if (!hasOnlySeparacao) {
          pulados++;
          continue;
        }

        // Verificar se já existe duplicata em expedição
        const existingDuplicate = await base44.asServiceRole.entities.ProductionOrder.filter({
          unique_number: op.unique_number,
          current_sector: "expedicao"
        });

        if (existingDuplicate.length > 0) {
          duplicados++;
          continue;
        }

        // Criar a duplicata em expedição
        const duplicateData = {
          unique_number: op.unique_number,
          order_id: op.order_id,
          order_number: op.order_number,
          product_id: op.product_id,
          reference: op.reference,
          product_name: op.product_name,
          complement: op.complement,
          control: op.control,
          color: op.color,
          quantity: op.quantity,
          cost_center: op.cost_center,
          request_date: op.request_date,
          environment: op.environment,
          purchase_location: op.purchase_location,
          observations: op.observations,
          technical_drawing_url: op.technical_drawing_url,
          production_sequence: op.production_sequence,
          current_sector: "expedicao",
          current_step_index: op.current_step_index || 0,
          sector_status: op.sector_status || "aguardando",
          status: op.status,
          delivery_deadline: op.delivery_deadline,
          is_intermediate: op.is_intermediate || false,
          parent_order_id: op.parent_order_id,
        };

        await base44.asServiceRole.entities.ProductionOrder.create(duplicateData);
        processados++;
      } catch (error) {
        erros.push({
          op_id: op.id,
          unique_number: op.unique_number,
          error: error.message
        });
      }
    }

    return Response.json({
      status: 'success',
      summary: {
        total_processados: processados,
        ja_existentes: duplicados,
        pulados: pulados,
        erros: erros.length,
        erros_detalhes: erros.length > 0 ? erros : null
      }
    });
  } catch (error) {
    console.error('[backfillExpedicaoSeparacao]:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});