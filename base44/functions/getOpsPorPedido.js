// base44/functions/_shared/sankhyaQuery.js

// 1. Em JS, não usamos interfaces ou tipos (ServiceContext, etc.)
// 2. Certifique-se de que os imports internos também usem .js se forem arquivos locais

export async function buscarProcessosPorPedido(pedidoId) {
  try {
    // Exemplo de uma chamada típica de banco ou API no Deno
    // Se estiver usando algum cliente específico, a lógica de tipos é removida
    const sql = `SELECT * FROM TSIPRO WHERE PEDIDO = ${pedidoId}`;
    
    // Supondo que você use um fetch ou um client de banco:
    const resultado = await fetch("URL_SANKHYA", {
       method: "POST",
       body: JSON.stringify({ query: sql })
    });

    if (!resultado.ok) {
      throw new Error("Erro na resposta do servidor Sankhya");
    }

    return await resultado.json();

  } catch (error) {
    // Mantendo o padrão de erro amigável que usamos no outro arquivo
    const msg = error.message || String(error);
    console.error("Erro em buscarProcessosPorPedido:", msg);
    throw new Error(msg);
  }
}
