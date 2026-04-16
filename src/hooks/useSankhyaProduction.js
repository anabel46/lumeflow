// src/hooks/useSankhyaProduction.js
import { useQuery, useMutation, useQueryClient } from 'https://esm.sh/@tanstack/react-query';// Adicione o .js no final para o ambiente Deno do Base44 reconhecer
import { base44 as api } from '../api/base44Client.js';
/**
 * HOOK DE BUSCA (READ)
 * Gerencia o cache e a atualização automática a cada 30s
 */
export function useSankhyaProduction() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sankhyaData'],
    queryFn: async () => {
      const response = await api.get('/functions/getDashboard');
      return response.data;
    },
    staleTime: 10000,      // Considera os dados "frescos" por 10s
    refetchInterval: 30000 // Atualiza o monitor automaticamente a cada 30s
  });

  // Transforma o JSON bruto em estrutura de Pedidos -> OPs
  const pedidos = data ? transformarParaPedidos(data) : [];

  const estatisticas = {
    totalOps: pedidos.reduce((acc, p) => acc + p.ops.length, 0),
    aguardando: pedidos.reduce((acc, p) => 
      acc + p.ops.filter(o => o.statusDisplay === 'Planejamento').length, 0),
    emProducao: pedidos.reduce((acc, p) => 
      acc + p.ops.filter(o => o.statusDisplay === 'Em Produção').length, 0),
    atrasados: pedidos.reduce((acc, p) => 
      acc + p.ops.filter(o => o.atrasado).length, 0),
  };

  return { pedidos, estatisticas, loading: isLoading, erro: error };
}

/**
 * HOOK DE ATUALIZAÇÃO (WRITE)
 * Altera o status da OP no Sankhya e limpa o cache para atualizar a tela
 */
export function useAtualizarStatus() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ numeroOp, novoStatus }) => {
      // Chama sua API Deno que comunica com o Sankhya
      const response = await api.post('/functions/updateOpStatus', {
        numeroOp,
        status: novoStatus
      });
      return response.data;
    },
    onSuccess: () => {
      // "Invalida" o cache: obriga o software a buscar os dados novos 
      // imediatamente após a mudança, sem esperar os 30s
      queryClient.invalidateQueries({ queryKey: ['sankhyaData'] });
    },
    onError: (err) => {
      console.error("Falha ao atualizar status no Sankhya:", err);
    }
  });

  return {
    atualizar: (numeroOp, novoStatus) => mutation.mutateAsync({ numeroOp, novoStatus }),
    isUpdating: mutation.isPending
  };
}

// --- FUNÇÕES AUXILIARES DE ALOCAÇÃO ---

function transformarParaPedidos(data) {
  const listaOriginal = Array.isArray(data) ? data : Object.values(data);

  const grupos = listaOriginal.reduce((acc, item) => {
    const ped = item.numeroPedido || 'S/N';
    if (!acc[ped]) {
      acc[ped] = {
        numeroPedido: ped,
        cliente: item.cliente || 'N/D',
        local: item.local,
        ops: []
      };
    }
    
    acc[ped].ops.push({
      ...item,
      progresso: calcularProgresso(item.atividades),
      statusDisplay: determinarStatus(item)
    });
    
    return acc;
  }, {});

  return Object.values(grupos);
}

function determinarStatus(op) {
  if (op.atrasado) return 'Atrasado';
  const emAndamento = op.atividades?.some(a => a.situacao === 'Em andamento');
  return emAndamento ? 'Em Produção' : 'Planejamento';
}

function calcularProgresso(atividades) {
  if (!atividades || atividades.length === 0) return 0;
  const concluidas = atividades.filter(a => a.situacao === 'Concluído').length;
  return Math.round((concluidas / atividades.length) * 100);
}