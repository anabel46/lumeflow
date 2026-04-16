// 1. Importação correta (ajuste o caminho se necessário)
import { fetchSankhya } from "./_shared/tokenManager.ts";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { idAtividade, status } = body;

    // 2. Chamada com o JSON.stringify para evitar o erro de 'known properties'
    const res = await fetchSankhya("CRUDService.saveRecord", {
      method: "POST",
      body: JSON.stringify({
        requestBody: {
          dataSet: {
            rootEntity: "AtividadeProgramaProducao",
            dataRow: {
              localFields: {
                IDATV: { $: idAtividade },
                SITUACAO: { $: status }
              }
            },
            entityName: "AtividadeProgramaProducao"
          }
        }
      })
    });

    return Response.json({ sucesso: true, mensagem: "Sankhya atualizado!" });

  } catch (error: any) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});