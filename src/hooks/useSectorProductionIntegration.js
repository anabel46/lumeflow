import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { SECTOR_TO_STAGE } from '@/lib/constants';

/**
 * Hook que monitora mudanças em ProductionOrder e sincroniza entre telas
 * Quando um setor muda o status de uma OP, a tela de Produção atualiza automaticamente
 */
export function useSectorProductionIntegration() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscrever mudanças em ProductionOrder (da tela de Setores)
    const unsubscribe = base44.entities.ProductionOrder.subscribe((event) => {
      if (event.type === 'update' && event.data) {
        const po = event.data;

        // Atualizar cache de dashboard-sankhya para refletir mudanças em tempo real
        queryClient.setQueryData(["sector-orders", po.current_sector], (old) => {
          if (!old) return [po];
          return old.map(o => o.id === po.id ? po : o);
        });

        // Invalidar dashboard para recalcular estatísticas
        queryClient.invalidateQueries({ queryKey: ["dashboard-sankhya"] });
        queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      }
    });

    return () => unsubscribe?.();
  }, [queryClient]);
}

/**
 * Mapeia um setor para seu status correspondente na tela de Produção
 */
export function getSectorStageStatus(sectorId, sectorStatus) {
  if (!sectorId) return null;

  const stageName = SECTOR_TO_STAGE[sectorId];
  if (!stageName) return null;

  return {
    stage: stageName,
    status: sectorStatus === 'em_producao' ? 'Em andamento' :
            sectorStatus === 'concluido' ? 'Finalizada' :
            'Aguardando'
  };
}