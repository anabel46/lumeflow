import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Backend function para registrar ações de setor
 * Cria log em SectorLog e sincroniza ProductionOrder
 * 
 * Recebe payload:
 * {
 *   production_order_id: string,
 *   unique_number: string,
 *   sector: string,
 *   action: "entrada" | "saida" | "retrabalho",
 *   observations?: string
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { production_order_id, unique_number, sector, action, observations } = payload;

    // Validar campos obrigatórios
    if (!production_order_id || !unique_number || !sector || !action) {
      return Response.json(
        { error: 'Campos obrigatórios: production_order_id, unique_number, sector, action' },
        { status: 400 }
      );
    }

    // 1. Criar log da ação em SectorLog
    const sectorLog = await base44.entities.SectorLog.create({
      production_order_id,
      unique_number,
      sector,
      action,
      operator: user.full_name || user.email,
      observations,
      timestamp: new Date().toISOString(),
    });

    // 2. Buscar ProductionOrder para sincronizar status
    const productionOrders = await base44.entities.ProductionOrder.filter({
      id: production_order_id,
    });

    if (productionOrders.length === 0) {
      return Response.json(
        { error: 'Production Order não encontrada' },
        { status: 404 }
      );
    }

    const po = productionOrders[0];

    // 3. Atualizar ProductionOrder com o novo status (sem alterar estrutura)
    // Apenas sincronizar o sector atual e seu status
    const updateData = {
      current_sector: sector,
      sector_status: action === 'entrada' ? 'em_producao' :
                     action === 'saida' ? 'concluido' :
                     'aguardando',
    };

    // Se "entrada", marcar hora de início
    if (action === 'entrada') {
      updateData.sector_started_at = new Date().toISOString();
    }

    // Se "saida" (concluída), marcar hora de conclusão
    if (action === 'saida') {
      updateData.finished_at = new Date().toISOString();
    }

    await base44.entities.ProductionOrder.update(production_order_id, updateData);

    return Response.json({
      success: true,
      log_id: sectorLog.id,
      message: `Ação '${action}' registrada para OP ${unique_number} no setor ${sector}`,
    });
  } catch (error) {
    console.error('[logSectorAction]:', error.message);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});