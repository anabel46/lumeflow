import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar TODAS as OPs sem limite
    const allOps = await base44.asServiceRole.entities.ProductionOrder.list("-created_date", 9999);

    let verificadas = 0;
    let duplicadas = 0;
    let jaExistem = 0;
    let puladas = 0;
    const erros = [];
    const adicionadas = [];

    for (const op of allOps) {
      try {
        verificadas++;

        // Validar condições de status
        if (op.status === 'finalizado' || op.status === 'cancelado') {
          puladas++;
          continue;
        }

        // Verificar se tem APENAS "SEPARACAO" na production_sequence
        const hasOnlySeparacao = 
          op.production_sequence && 
          Array.isArray(op.production_sequence) &&
          op.production_sequence.length === 1 &&
          op.production_sequence[0] === "SEPARACAO";

        if (!hasOnlySeparacao) {
          puladas++;
          continue;
        }

        // Verificar se já existe duplicata em expedição
        const existingDuplicate = await base44.asServiceRole.entities.ProductionOrder.filter({
          unique_number: op.unique_number,
          current_sector: "expedicao"
        });

        if (existingDuplicate.length > 0) {
          jaExistem++;
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
          expedicao_status: "aguardando_coleta",
        };

        await base44.asServiceRole.entities.ProductionOrder.create(duplicateData);
        
        // Marcar OP original com status de expedição
        await base44.asServiceRole.entities.ProductionOrder.update(op.id, {
          expedicao_status: "aguardando_coleta"
        }).catch(() => null);
        
        adicionadas.push({
          pedido: op.order_number,
          op: op.unique_number,
          produto: op.product_name,
          quantidade: op.quantity
        });
        
        duplicadas++;
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
        total_verificadas: verificadas,
        total_duplicadas: duplicadas,
        ja_existentes: jaExistem,
        puladas: puladas,
        erros: erros.length,
        ops_adicionadas: adicionadas,
        erros_detalhes: erros.length > 0 ? erros : null
      }
    });
  } catch (error) {
    console.error('[backfillExpedicaoSeparacao]:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});