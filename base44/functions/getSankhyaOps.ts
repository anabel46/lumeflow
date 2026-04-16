// base44/functions/getSankhyaOps.ts
import { buscarProcessosPorPedido } from "./_shared/sankhyaQuery.ts";

Deno.serve(async (_req) => {
  try {
    const dados = await buscarProcessosPorPedido();
    return Response.json(dados);
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro em getSankhyaOps:", msg);
    return Response.json({ erro: msg }, { status: 500 });
  }
});