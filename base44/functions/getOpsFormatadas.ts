// base44/functions/getOpsFormatadas.ts
import { buscarProcessosPorPedido, OpDTO } from "./_shared/sankhyaQuery.ts";

Deno.serve(async (_req) => {
  try {
    const dadosBrutos = await buscarProcessosPorPedido();
    const listaOps: OpDTO[] = [];
    
    // Flatten: transforma estrutura hierárquica em array
    for (const pedidoOps of Object.values(dadosBrutos)) {
      for (const op of Object.values(pedidoOps)) {
        listaOps.push(op);
      }
    }
    
    return Response.json(listaOps);
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro em getOpsFormatadas:", msg);
    return Response.json({ erro: msg }, { status: 500 });
  }
});