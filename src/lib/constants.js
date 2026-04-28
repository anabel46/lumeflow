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
  { id: "mesa_barra", label: "Mesa Barra", icon: "Store" },
  { id: "mesa_ipanema", label: "Mesa Ipanema", icon: "Store" },
  { id: "mesa_sao_gabriel", label: "Mesa São Gabriel", icon: "Store" },
  { id: "mesa_vila_madalena", label: "Mesa Vila Madalena", icon: "Store" },
  { id: "mesa_fabrica", label: "Mesa Fábrica", icon: "Store" },
  { id: "embalagem", label: "Embalagem", icon: "Package" },
  { id: "agendamento", label: "Agendamento", icon: "Calendar" },
  { id: "expedicao", label: "Expedição", icon: "Truck" },
];

export const SECTOR_LABELS = SECTORS.reduce((acc, s) => {
  acc[s.id] = s.label;
  return acc;
}, {});

// Mapeamento de localização de compra → mesa correspondente
export const LOCATION_TO_MESA = {
  "barra": "mesa_barra",
  "ipanema": "mesa_ipanema",
  "sao_gabriel": "mesa_sao_gabriel",
  "vila_madalena": "mesa_vila_madalena",
  "fabrica": "mesa_fabrica",
};

export const PURCHASE_LOCATIONS = [
  { id: "barra", label: "Barra", mesa: "mesa_barra" },
  { id: "ipanema", label: "Ipanema", mesa: "mesa_ipanema" },
  { id: "sao_gabriel", label: "São Gabriel", mesa: "mesa_sao_gabriel" },
  { id: "vila_madalena", label: "Vila Madalena", mesa: "mesa_vila_madalena" },
  { id: "fabrica", label: "Fábrica", mesa: "mesa_fabrica" },
];

export const STATUS_COLORS = {
  aprovacao_pendente: "bg-amber-100 text-amber-800 border-amber-300",
  confirmado: "bg-teal-100 text-teal-800 border-teal-300",
  aguardando: "bg-yellow-100 text-yellow-800 border-yellow-200",
  planejamento: "bg-blue-100 text-blue-800 border-blue-200",
  em_producao: "bg-emerald-100 text-emerald-800 border-emerald-200",
  finalizado: "bg-gray-100 text-gray-600 border-gray-200",
  cancelado: "bg-red-100 text-red-800 border-red-200",
  pausado: "bg-orange-100 text-orange-800 border-orange-200",
};

export const STATUS_LABELS = {
  aprovacao_pendente: "Aprovação Pendente",
  confirmado: "Confirmado",
  aguardando: "Aguardando",
  planejamento: "Planejamento",
  em_producao: "Em Produção",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
  pausado: "Pausado",
};

// Mapeamento de Setor → Etapa (para sincronização Setores ↔ Produção)
export const SECTOR_TO_STAGE = {
  "estamparia": "ESTAMPARIA",
  "tornearia": "TORNEARIA",
  "corte": "CORTE",
  "solda": "SOLDA",
  "lixa": "LIXA",
  "repuxo": "REPUXO",
  "pintura": "PINTURA",
  "montagem_decorativa": "MONTAGEM",
  "montagem_eletrica": "MONTAGEM",
  "montagem_perfil": "MONTAGEM",
  "montagem_embutidos": "MONTAGEM",
  "controle_qualidade": "CONTROLE_QUALIDADE",
  "embalagem": "EMBALAGEM",
  "mesa_barra": "ENTREGA",
  "mesa_ipanema": "ENTREGA",
  "mesa_sao_gabriel": "ENTREGA",
  "mesa_vila_madalena": "ENTREGA",
  "mesa_fabrica": "ENTREGA",
  "agendamento": "AGENDAMENTO",
  "expedicao": "SEPARACAO",
};