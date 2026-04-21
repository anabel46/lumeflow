// base44/functions/_shared/sankhyaQuery.js

/**
 * Executor genérico para consultas Sankhya.
 * Centraliza a lógica de rede, autenticação e tratamento de erro.
 */
async function executarSankhyaQuery(sql) {
  const SANKHYA_URL = Deno.env.get("SANKHYA_API_URL");
  
  try {
    const response = await fetch(SANKHYA_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SANKHYA_TOKEN")}`
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sankhya [${response.status}]: ${errorText || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    const msg = error.message || String(error);
    console.error(`[Sankhya Database Error]: ${msg}`);
    throw new Error(msg);
  }
}

/**
 * Busca processos específicos por pedido.
 * Agora muito mais simples e limpa!
 */
export async function buscarProcessosPorPedido(pedidoId) {
  if (!pedidoId) throw new Error("O ID do pedido é obrigatório.");
  
  const sql = `SELECT * FROM TSIPRO WHERE PEDIDO = ${pedidoId}`;
  return await executarSankhyaQuery(sql);
}

/**
 * Exemplo de como seria fácil criar outra consulta agora:
 */
export async function buscarClientePorCpf(cpf) {
  const sql = `SELECT NOMEPARC FROM TGFPAR WHERE CGC_CPF = '${cpf}'`;
  return await executarSankhyaQuery(sql);
}
