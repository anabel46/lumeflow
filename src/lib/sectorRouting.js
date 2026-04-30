/**
 * Mapeamento de setores: palavras-chave na descricao da atividade → sectorId da rota
 */
export const SECTOR_KEYWORDS = {
  separacao:            ["SEPARAÇÃO", "SEPARACAO"],
  estamparia:           ["ESTAMPARIA", "REPUXE", "REPUXO"],
  tornearia:            ["TORNEARIA"],
  corte:                ["CORTE"],
  solda:                ["SOLDA"],
  lixa:                 ["LIXA"],
  pintura:              ["PINTURA"],
  montagem:             ["MONTAGEM"],
  montagem_decorativa:  ["MONTAGEM"],
  montagem_eletrica:    ["MONTAGEM"],
  montagem_perfil:      ["MONTAGEM PERFIL"],
  montagem_embutidos:   ["MONTAGEM EMBUTIDO"],
  controle_qualidade:   ["CONTROLE QUALIDADE", "QUALIDADE", " CQ"],
  embalagem:            ["EMBALAGEM"],
};

/**
 * Retorna as palavras-chave para um sectorId.
 */
export function getKeywordsForSector(sectorId) {
  return SECTOR_KEYWORDS[sectorId] || [];
}

/**
 * Verifica se uma atividade corresponde ao setor atual.
 */
function atividadeMatchSetor(atividade, keywords) {
  const desc = (atividade.descricao || "").toUpperCase();
  return keywords.some(kw => desc.includes(kw.toUpperCase()));
}

/**
 * Dado um array de atividades de uma OP e o sectorId atual,
 * retorna a atividade relevante para esse setor (a primeira que bate).
 */
export function getAtividadeDoSetor(atividades, sectorId) {
  const keywords = getKeywordsForSector(sectorId);
  if (!keywords.length || !atividades?.length) return null;
  return atividades.find(a => atividadeMatchSetor(a, keywords)) || null;
}

/**
 * Filtra OPs (lista plana) que possuem ao menos uma atividade do setor.
 * Retorna as OPs com um campo extra `sectorActivity` com a atividade relevante.
 */
export function filtrarOpsPorSetor(ops, sectorId) {
  const keywords = getKeywordsForSector(sectorId);
  if (!keywords.length) return [];

  return ops
    .filter(op => {
      const atividades = op.sankhya_fluxo || op.atividades || [];
      return atividades.some(a => atividadeMatchSetor(a, keywords));
    })
    .map(op => {
      const atividades = op.sankhya_fluxo || op.atividades || [];
      const sectorActivity = atividades.find(a => atividadeMatchSetor(a, keywords));
      return { ...op, sectorActivity };
    });
}

/**
 * Classifica as OPs filtradas em grupos baseado na situação da atividade do setor.
 * Retorna { returns, waiting, inProgress, done }
 */
export function classificarOpsPorStatus(ops) {
  const returns = [];
  const waiting = [];
  const inProgress = [];
  const done = [];

  ops.forEach(op => {
    const situacao = (op.sectorActivity?.situacao_atividade || op.sectorActivity?.situacao || "").toLowerCase();

    if (op.return_from_sector?.has_issues) {
      returns.push(op);
    } else if (situacao === "finalizada" || situacao === "f") {
      done.push(op);
    } else if (situacao === "em andamento" || situacao === "a") {
      inProgress.push(op);
    } else {
      // "aguardando", "aguardando aceite", "p", ou sem situação
      waiting.push(op);
    }
  });

  return { returns, waiting, inProgress, done };
}