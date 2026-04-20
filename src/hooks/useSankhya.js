import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Hook React para consumir dados da integração Sankhya via backend function.
 *
 * Expõe:
 *   ops           - lista flat de OPs ativas
 *   opsPorPedido  - OPs agrupadas por pedido
 *   dashboard     - totais/contagens
 *   loading       - boolean
 *   error         - string | null
 *   refetch()     - recarrega dados manualmente
 */
export function useSankhya() {
  const [ops, setOps] = useState([]);
  const [opsPorPedido, setOpsPorPedido] = useState({});
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke("getDashboard", {});
      const { ops: flatOps, opsPorPedido: grouped, dashboard: dash } = response.data;
      setOps(flatOps || []);
      setOpsPorPedido(grouped || {});
      setDashboard(dash || null);
    } catch (err) {
      setError(err.message || "Erro ao buscar dados do Sankhya");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch ao montar
  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ops, opsPorPedido, dashboard, loading, error, refetch };
}