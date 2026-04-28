import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook que faz polling automático da tela de Produção a cada 15 segundos
 * e sincroniza com atualizações de SectorView
 */
export function useProductionSync(pollingInterval = 15000) {
  const queryClient = useQueryClient();

  // Setup polling automático
  useEffect(() => {
    const interval = setInterval(() => {
      // Invalida o cache de dashboard do Sankhya para atualizar
      queryClient.invalidateQueries({ queryKey: ["dashboard-sankhya"] });
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [queryClient, pollingInterval]);

  // Subscrever a mudanças em ProductionOrder em tempo real
  useEffect(() => {
    const unsubscribe = base44.entities.ProductionOrder.subscribe((event) => {
      if (event.type === 'update') {
        // Invalidar cache para forçar re-render com dados atualizados
        queryClient.invalidateQueries({ queryKey: ["dashboard-sankhya"] });
      }
    });

    return () => unsubscribe?.();
  }, [queryClient]);
}