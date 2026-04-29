import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return Response.json({ error: "Use POST" }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    // body.produtos = array de { reference, components, production_sequence, fluxo_detalhado }

    const produtos = body.produtos || [];
    const resultados = { atualizados: 0, nao_encontrados: [], erros: [] };

    for (const prod of produtos) {
      try {
        const found = await base44.entities.Product.filter({ reference: prod.reference });
        if (!found || found.length === 0) {
          resultados.nao_encontrados.push(prod.reference);
          continue;
        }
        const existing = found[0];
        await base44.entities.Product.update(existing.id, {
          components: prod.components,
          production_sequence: prod.production_sequence.length > 0
            ? prod.production_sequence
            : existing.production_sequence,
          sankhya_fluxo: prod.fluxo_detalhado,
        });
        resultados.atualizados++;
      } catch (e) {
        resultados.erros.push({ ref: prod.reference, erro: e.message });
      }
    }

    return Response.json({
      sucesso:          true,
      atualizados:      resultados.atualizados,
      nao_encontrados:  resultados.nao_encontrados,
      erros:            resultados.erros,
    });

  } catch (error) {
    console.error("❌ Erro apply:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});