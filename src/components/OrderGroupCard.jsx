// src/components/OrderGroupCard.jsx
import React from 'react';

export default function OrderGroupCard({ 
  group, 
  selectedIds, 
  onToggle, 
  onStart, 
  onPause, 
  viewMode = 'cards' 
}) {
  const [expanded, setExpanded] = React.useState(true);

  // Mapeamento de cores baseado no status amigável
  const getStatusColor = (status) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('produção') || s.includes('andamento')) return 'bg-green-100 text-green-700';
    if (s.includes('pausado') || s.includes('espera')) return 'bg-yellow-100 text-yellow-700';
    if (s.includes('atrasado')) return 'bg-red-100 text-red-700';
    if (s.includes('finalizado') || s.includes('concluído')) return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 mb-4 overflow-hidden">
      {/* Header do Pedido */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox"
              // Usamos o numeroPedido como identificador único para o grupo
              checked={selectedIds.has(group.numeroPedido)}
              onChange={() => onToggle(group.numeroPedido)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <h3 className="font-bold text-lg text-gray-900">
                Pedido #{group.numeroPedido}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                <span className="font-medium text-gray-700">{group.cliente || 'Consumidor Final'}</span>
                <span>•</span>
                <span>{group.local || 'Geral'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-gray-700">
                {group.ops?.length || 0} OPs Total
              </div>
              <div className="text-xs text-blue-600 font-medium">
                {group.ops?.filter(o => o.statusDisplay?.includes('Produção')).length || 0} em atividade
              </div>
            </div>
            <button 
              onClick={() => setExpanded(!expanded)}
              className="p-2 hover:bg-white rounded-full shadow-sm border border-transparent hover:border-gray-200 transition-all"
            >
              {expanded ? '▲' : '▼'}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de OPs */}
      {expanded && (
        <div className="p-4 space-y-4">
          {group.ops?.map((op) => (
            <div 
              key={op.numeroOp}
              className={`border rounded-xl p-4 transition-all ${
                op.statusDisplay?.includes('Atrasado') 
                  ? 'border-red-200 bg-red-50/30' 
                  : 'border-gray-100 hover:border-blue-200 hover:shadow-sm'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(op.numeroOp)}
                    onChange={() => onToggle(op.numeroOp)}
                    className="w-4 h-4 rounded border-gray-300 mt-1.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        OP {op.numeroOp}
                      </span>
                      <h4 className="font-semibold text-gray-800">
                        {/* Alocação: Pegando o nome do primeiro produto da OP */}
                        {op.produtos?.[0]?.descricao || "Produto não identificado"}
                      </h4>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                      <span className="bg-gray-100 px-2 py-0.5 rounded">Qtd: {op.quantidade || 0}</span>
                      <span>Ref: {op.produtos?.[0]?.referencia || 'N/A'}</span>
                    </div>

                    {/* Barra de progresso dinâmica baseada no status das atividades */}
                    <div className="max-w-md">
                      <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">
                        <span>Status da Produção</span>
                        <span className="text-blue-600">{op.progresso || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${op.progresso || 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Tags de Atividades (Tornearia, Pintura, etc) */}
                    <div className="flex gap-1.5 mt-4 flex-wrap">
                      {op.atividades?.map((atv, idx) => (
                        <span 
                          key={idx}
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                            atv.situacao === 'Concluído'
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : atv.situacao === 'Em andamento'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-400 border border-gray-200'
                          }`}
                        >
                          {atv.nomeAtividade || atv.situacao}
                          {atv.temQualidade && ' ✓'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bloco de Status e Ações */}
                <div className="flex lg:flex-col items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getStatusColor(op.statusDisplay)}`}>
                    {op.statusDisplay || 'Planejamento'}
                  </span>
                  
                  <div className="flex gap-2">
                    {op.statusDisplay?.includes('Produção') ? (
                      <button
                        onClick={() => onPause?.(op.numeroOp)}
                        className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
                      >
                        ⏸ Pausar
                      </button>
                    ) : (
                      <button
                        onClick={() => onStart?.(op.numeroOp)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
                      >
                        ▶ Iniciar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}