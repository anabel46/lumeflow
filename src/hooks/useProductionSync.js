import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook que sincroniza mudanças em ProductionOrder com a tela de Produção
 * - Polling automático de 15s (fallback)
 * - Subscrição em tempo real a atualizações de OP (prioritário)
 * 
 * Não altera nenhuma formatação ou estrutura da tela de Produção.
 * Apenas invalida cache para forçar refetch com dados atualizados.
 */
export function useProductionSync(pollingInterval = 15000) {
  const queryClient = useQueryClient();

  // Setup polling automático (fallback para garantir sincronização)
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ 
        queryKey: ["dashboard-sankhya"],
        exact: false 
      });
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [queryClient, pollingInterval]);

  // Subscrever a mudanças em ProductionOrder em tempo real (sem timeout)
  useEffect(() => {
    let unsubscribe;
    
    try {
      unsubscribe = base44.entities.ProductionOrder.subscribe((event) => {
        // Atualizar cache quando OP é modificada em outro lugar (ex: SectorView)
        if (event.type === 'update' || event.type === 'create') {
          queryClient.invalidateQueries({ 
            queryKey: ["dashboard-sankhya"],
            exact: false 
          });
        }
      });
    } catch (error) {
      console.warn('[useProductionSync] Subscrição falhou, usando apenas polling:', error?.message);
    }

    return () => unsubscribe?.();
  }, [queryClient]);
}