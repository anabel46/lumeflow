import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar todos os pedidos
    const allOrders = await base44.asServiceRole.entities.Order.list("-created_date", 100);

    // Pegar exemplo completo do primeiro pedido
    const firstOrder = allOrders[0];

    return Response.json({
      total_orders: allOrders.length,
      sample_order: firstOrder ? {
        id: firstOrder.id,
        ...firstOrder
      } : null,
      all_field_names: firstOrder ? Object.keys(firstOrder).sort() : [],
      first_5_orders_summary: allOrders.slice(0, 5).map(o => ({
        id: o.id,
        order_number: o.order_number,
        client_name: o.client_name,
        request_date: o.request_date,
        delivery_deadline: o.delivery_deadline,
        status: o.status,
        created_by: o.created_by
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});