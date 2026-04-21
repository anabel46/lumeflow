// base44/functions/_shared/sankhyaQuery.js

/**
 * Busca processos no Sankhya filtrando pelo ID do pedido.
 * @param {number|string} pedidoId - O identificador do pedido.
 */
export async function buscarProcessosPorPedido(pedidoId) {
  try {
    // Exemplo de query SQL (ajuste conforme sua tabela real)
    const sql = `SELECT * FROM TSIPRO WHERE PEDIDO = ${pedidoId}`;

    // No Deno, usamos o fetch padrão para chamadas de API
    const response = await fetch("SEU_ENDPOINT_SANKHYA", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Adicione aqui seus headers de autenticação/token se necessário
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      throw new Error(`Erro na consulta Sankhya: ${response.statusText}`);
    }

    return await response.json();
    
  } catch (error) {
    // Mantendo o padrão de erro consistente com o getSankhyaOps.js
    const msg = error.message || String(error);
    console.error("Erro em buscarProcessosPorPedido:", msg);
    
    // Repassamos o erro para ser capturado pelo try/catch do Deno.serve
    throw new Error(msg);
  }
}
