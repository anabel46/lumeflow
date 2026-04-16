// base44/functions/getDashboard.ts
import { buscarProcessosPorPedido, OpDTO } from "./_shared/sankhyaQuery.ts";

interface Estatisticas {
  totalOps: number;
  aguardando: number;
  emAndamento: number;
  finalizadas: number;
}

Deno.serve(async (_req) => {
  try {
    // buscarProcessosPorPedido retorna: Record<pedido, Record<op, OpDTO>>
    const dadosPorPedido = await buscarProcessosPorPedido();
    
    // Calcular estatísticas
    const estatisticas = calcularEstatisticas(dadosPorPedido);
    
    return Response.json({
      estatisticas,
      pedidos: dadosPorPedido  // Estrutura: { "916765": { "39448": {...} } }
    });
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro em getDashboard:", msg);
    return Response.json({ erro: msg }, { status: 500 });
  }
});

function calcularEstatisticas(
  dados: Record<string, Record<string, OpDTO>>
): Estatisticas {
  let totalOps = 0;
  let aguardando = 0;
  let emAndamento = 0;
  let finalizadas = 0;

  for (const pedidoOps of Object.values(dados)) {
    for (const op of Object.values(pedidoOps)) {
      totalOps++;
      
      const temAguardando = op.atividades?.some(a => a.situacao === "Aguardando aceite");
      const temEmAndamento = op.atividades?.some(a => a.situacao === "Em andamento");
      
      if (temAguardando) aguardando++;
      else if (temEmAndamento) emAndamento++;
      
      if (op.situacaoGeral === "C") finalizadas++;
    }
  }

  return { totalOps, aguardando, emAndamento, finalizadas };
}