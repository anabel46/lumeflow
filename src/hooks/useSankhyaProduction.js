import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '../api/base44Client';

// ── HOOK PRINCIPAL (READ) ────────────────────────────────────────────────────
export function useSankhyaProduction() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sankhyaData'],
    queryFn: async () => {
      // ✅ Forma correta de chamar uma function no Base44
      const response = await base44.functions.invoke('getDashboard', {});
      // A function retorna { pedidos, estatisticas }
      return response;
    },
    staleTime: 10_000,       // dados frescos por 10s
    refetchInterval: 30_000, // atualiza a cada 30s
    retry: 1,
  });

  const pedidos = data?.pedidos ? transformarParaPedidos(data.pedidos) : [];

  const estatisticas = data?.estatisticas ?? {
    totalOps:    0,
    aguardando:  0,
    emAndamento: 0,
    finalizadas: 0,
  };

  return {
    pedidos,
    estatisticas,
    loading: isLoading,
    erro:    error,
  };
}

// ── HOOK DE ATUALIZAÇÃO (WRITE) ──────────────────────────────────────────────
export function useAtualizarStatus() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ numeroOp, novoStatus }) => {
      const response = await base44.functions.invoke('updateOpStatus', {
        numeroOp,
        status: novoStatus,
      });
      return response;
    },
    onSuccess: () => {
      // Invalida cache e rebusca imediatamente
      queryClient.invalidateQueries({ queryKey: ['sankhyaData'] });
    },
    onError: (err) => {
      console.error('Falha ao atualizar status no Sankhya:', err);
    },
  });

  return {
    atualizar:  (numeroOp, novoStatus) => mutation.mutateAsync({ numeroOp, novoStatus }),
    isUpdating: mutation.isPending,
  };
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function transformarParaPedidos(pedidosMap) {
  const resultado = [];

  for (const [numPedido, ops] of Object.entries(pedidosMap)) {
    const opsList = Object.values(ops).map(op => ({
      ...op,
      progresso:     calcularProgresso(op.atividades),
      statusDisplay: determinarStatus(op),
    }));

    resultado.push({
      numeroPedido: numPedido,
      ops:          opsList,
    });
  }

  // Ordena por número de pedido decrescente
  return resultado.sort((a, b) => Number(b.numeroPedido) - Number(a.numeroPedido));
}

function determinarStatus(op) {
  const ativs = op.atividades || [];
  const emAndamento = ativs.some(a => a.situacao === 'Em andamento');
  const todas       = ativs.length;
  const finalizadas = ativs.filter(a => a.situacao === 'Finalizada').length;

  if (emAndamento)                      return 'Em Produção';
  if (todas > 0 && finalizadas === todas) return 'Finalizado';
  return 'Planejamento';
}

function calcularProgresso(atividades) {
  if (!atividades || atividades.length === 0) return 0;
  const concluidas = atividades.filter(a => a.situacao === 'Finalizada').length;
  return Math.round((concluidas / atividades.length) * 100);
}