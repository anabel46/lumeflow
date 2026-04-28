import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook que sincroniza mudanças em ProductionOrder entre telas
 * Monitora atualizações vindo de SectorView e invalida cache da tela de Produção
 * 
 * Não modifica formatação, estrutura ou lógica de visualização.
 * Apenas sincroniza dados de status entre ProductionOrder e cache.
 */
export function useSectorProductionIntegration() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unsubscribe;
    
    try {
      // Subscrever mudanças em ProductionOrder vindo de SectorView
      unsubscribe = base44.entities.ProductionOrder.subscribe((event) => {
        if (event.type === 'update' && event.data) {
          // Invalidar cache para forçar refetch com dados atualizados
          // Sem reprocessar ou reformatar dados
          queryClient.invalidateQueries({ 
            queryKey: ["dashboard-sankhya"],
            exact: false 
          });
        }
      });
    } catch (error) {
      console.warn('[useSectorProductionIntegration] Subscrição falhou:', error?.message);
    }

    return () => unsubscribe?.();
  }, [queryClient]);
}