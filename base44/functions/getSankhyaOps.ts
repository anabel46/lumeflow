// base44/functions/getSankhyaOps.js
import { buscarProcessosPorPedido } from "./_shared/sankhyaQuery.js";

Deno.serve(async (_req) => {
  try {
    const dados = await buscarProcessosPorPedido();
    return Response.json(dados);
    
  } catch (error) {
    // Em JS, removemos a anotação de tipo ': unknown'
    const msg = error.message || String(error);
    console.error("Erro em getSankhyaOps:", msg);
    
    return Response.json(
      { erro: msg }, 
      { status: 500 }
    );
  }
});
