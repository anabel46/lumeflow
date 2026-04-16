// base44/functions/getOpsPorPedido.ts - VERSÃO CORRIGIDA

import { buscarProcessosPorPedido, OpDTO } from "./_shared/sankhyaQuery.ts";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const numeroPedido = url.searchParams.get("pedido");

    const dadosBrutos = await buscarProcessosPorPedido();

    // Se passar ?pedido=123, filtra apenas esse pedido
    if (numeroPedido) {
      const pedidoEspecifico = dadosBrutos[numeroPedido];
      if (!pedidoEspecifico) {
        return Response.json({ erro: "Pedido não encontrado" }, { status: 404 });
      }
      return Response.json({ [numeroPedido]: pedidoEspecifico });
    }

    // Senão retorna todos
    return Response.json(dadosBrutos);
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro em getOpsPorPedido:", msg);
    return Response.json({ erro: msg }, { status: 500 });
  }
});