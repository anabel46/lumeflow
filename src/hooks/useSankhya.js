import { useState, useEffect, useCallback } from "react";
import { getSankhyaOps, getOpsPorPedido, getDashboard } from "@/integrations/sankhya";

/**
 * Hook React para consumir dados da integração Sankhya.
 *
 * Expõe:
 *   ops           - lista flat de OPs ativas
 *   opsPorPedido  - OPs agrupadas por pedido → idiproc
 *   dashboard     - totais/contagens
 *   loading       - boolean
 *   error         - string | null
 *   fetchOps()    - recarrega OPs manualmente
 *   fetchDashboard() - recarrega dashboard manualmente
 */
export function useSankhya() {
  const [ops, setOps] = useState([]);
  const [opsPorPedido, setOpsPorPedido] = useState({});
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [flatOps, grouped] = await Promise.all([
        getSankhyaOps(),
        getOpsPorPedido(),
      ]);
      setOps(flatOps);
      setOpsPorPedido(grouped);
    } catch (err) {
      setError(err.message || "Erro ao buscar OPs do Sankhya");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboard();
      setDashboard(data);
    } catch (err) {
      setError(err.message || "Erro ao buscar dashboard do Sankhya");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch ao montar
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const [flatOps, grouped, dash] = await Promise.all([
          getSankhyaOps(),
          getOpsPorPedido(),
          getDashboard(),
        ]);
        setOps(flatOps);
        setOpsPorPedido(grouped);
        setDashboard(dash);
      } catch (err) {
        setError(err.message || "Erro ao inicializar dados do Sankhya");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  return { ops, opsPorPedido, dashboard, loading, error, fetchOps, fetchDashboard };
}