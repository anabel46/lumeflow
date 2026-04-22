import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Busca dados do banco (ProductionOrder)
    const orders = await base44.entities.ProductionOrder.list();
    
    // Agrupa por número de pedido
    const pedidos = {};
    let totalOps = 0;
    let emAndamento = 0;
    let finalizadas = 0;
    let aguardando = 0;

    for (const order of orders) {
      const numPedido = order.order_number;
      if (!pedidos[numPedido]) {
        pedidos[numPedido] = {};
      }
      
      // Mapeia status para situacao geral (A=ativo, P=planejamento, F=finalizado)
      const situacaoGeral = order.status === "em_producao" ? "A" : order.status === "planejamento" ? "P" : "F";
      
      pedidos[numPedido][order.unique_number] = {
        numeroPedido: parseInt(numPedido),
        numeroOp: parseInt(order.unique_number),
        situacaoGeral,
        descricaoAtividade: order.current_sector || "—",
        produtos: [{
          codigo: order.product_id || "—",
          descricao: order.product_name,
          referencia: order.reference || "—",
        }],
        atividades: order.production_sequence?.length > 0 ? [{
          id: order.current_step_index?.toString() || "0",
          descricao: order.current_sector || "—",
          situacao: mapearSectorStatus(order.sector_status),
          dhAceite: order.sector_started_at || "",
          dhInicio: order.sector_started_at || "",
        }] : [],
      };

      totalOps++;
      if (order.status === "em_producao") emAndamento++;
      if (order.status === "finalizado") finalizadas++;
      if (order.status === "planejamento") aguardando++;
    }

    return Response.json({
      data: {
        estatisticas: {
          totalOps,
          emAndamento,
          finalizadas,
          aguardando,
        },
        pedidos,
      }
    });
  } catch (error) {
    console.error("Erro em getDashboard:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function mapearSectorStatus(status) {
  const mapa = {
    "aguardando": "Aguardando aceite",
    "em_producao": "Em andamento",
    "concluido": "Finalizada",
  };
  return mapa[status] || "Aguardando aceite";
}