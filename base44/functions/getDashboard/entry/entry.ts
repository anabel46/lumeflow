// base44/functions/_shared/sankhyaQuery.js

/**
 * Busca processos no Sankhya filtrando pelo ID do pedido.
 * Utiliza variáveis de ambiente para maior segurança.
 * @param {number|string} pedidoId
 */
export async function buscarProcessosPorPedido(pedidoId) {
  // No Deno, usamos Deno.env.get em vez de process.env
  const SANKHYA_URL = Deno.env.get("SANKHYA_API_URL");
  
  try {
    if (!pedidoId) throw new Error("O ID do pedido é obrigatório.");

    const sql = `SELECT * FROM TSIPRO WHERE PEDIDO = ${pedidoId}`;

    const response = await fetch(SANKHYA_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        // Caso precise de Token, ele viria aqui:
        // "Authorization": `Bearer ${Deno.env.get("SANKHYA_TOKEN")}`
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro Sankhya (${response.status}): ${errorText || response.statusText}`);
    }

    return await response.json();

  } catch (error) {
    const msg = error.message || String(error);
    console.error(`[Sankhya Query Error]: ${msg}`);
    
    // Mantendo a propagação do erro para o Deno.serve tratar
    throw new Error(msg);
  }
}
