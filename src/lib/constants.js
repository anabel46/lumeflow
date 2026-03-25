export const SECTORS = [
  { id: "estamparia", label: "Estamparia", icon: "Stamp" },
  { id: "tornearia", label: "Tornearia", icon: "Cog" },
  { id: "corte", label: "Corte", icon: "Scissors" },
  { id: "solda", label: "Solda", icon: "Flame" },
  { id: "lixa", label: "Lixa", icon: "Paintbrush" },
  { id: "repuxo", label: "Repuxo", icon: "CircleDot" },
  { id: "pintura", label: "Pintura", icon: "Palette" },
  { id: "montagem_decorativa", label: "Montagem Decorativa", icon: "Sparkles" },
  { id: "montagem_eletrica", label: "Montagem Elétrica", icon: "Zap" },
  { id: "montagem_perfil", label: "Montagem Perfil", icon: "Layers" },
  { id: "montagem_embutidos", label: "Montagem Embutidos", icon: "Box" },
  { id: "controle_qualidade", label: "Controle de Qualidade", icon: "ShieldCheck" },
  { id: "embalagem", label: "Embalagem", icon: "Package" },
];

export const SECTOR_LABELS = SECTORS.reduce((acc, s) => {
  acc[s.id] = s.label;
  return acc;
}, {});

export const STATUS_COLORS = {
  aguardando: "bg-yellow-100 text-yellow-800 border-yellow-200",
  planejamento: "bg-blue-100 text-blue-800 border-blue-200",
  em_producao: "bg-emerald-100 text-emerald-800 border-emerald-200",
  finalizado: "bg-gray-100 text-gray-600 border-gray-200",
  cancelado: "bg-red-100 text-red-800 border-red-200",
  pausado: "bg-orange-100 text-orange-800 border-orange-200",
};

export const STATUS_LABELS = {
  aguardando: "Aguardando",
  planejamento: "Planejamento",
  em_producao: "Em Produção",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
  pausado: "Pausado",
};