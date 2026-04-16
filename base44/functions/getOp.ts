// base44/functions/getOp.ts
import { buscarProcessosPorPedido, OpDTO } from "./_shared/sankhyaQuery.ts";

Deno.serve(async (req) => {
  try {
    const body = await req.json() as { numeroOp: number };
    const { numeroOp } = body;

    if (!numeroOp) {
      return Response.json(
        { erro: "numeroOp é obrigatório" }, 
        { status: 400 }
      );
    }

    const dadosBrutos = await buscarProcessosPorPedido();
    
    let opEncontrada: OpDTO | null = null;
    
    // Busca a OP em todos os pedidos
    outer: for (const pedidoOps of Object.values(dadosBrutos)) {
      for (const op of Object.values(pedidoOps)) {
        if (op.numeroOp === numeroOp) {
          opEncontrada = op;
          break outer;
        }
      }
    }

    if (!opEncontrada) {
      return Response.json({ erro: "OP não encontrada" }, { status: 404 });
    }

    return Response.json(opEncontrada);
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro em getOp:", msg);
    return Response.json({ erro: msg }, { status: 500 });
  }
});