// base44/functions/_shared/sankhyaQuery.js

/**
 * Busca processos no Sankhya filtrando pelo ID do pedido.
 * @param {number|string} pedidoId
 */
export async function buscarProcessosPorPedido(pedidoId) {
  try {
    const sql = `SELECT * FROM TSIPRO WHERE PEDIDO = ${pedidoId}`;

    const response = await fetch("SEU_ENDPOINT_SANKHYA", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      throw new Error(`Erro Sankhya: ${response.status} ${response.statusText}`);
    }

    return await response.json();

  } catch (error) {
    const msg = error.message || String(error);
    console.error("Erro em buscarProcessosPorPedido:", msg);
    
    // Re-lançamos para que o Deno.serve no arquivo principal capture e trate
    throw new Error(msg);
  }
}
