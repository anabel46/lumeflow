import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

// Cache em memória para não bater a API toda vez que o componente remonta
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutos

export function useSankhyaData() {
  const [data, setData] = useState(_cache);
  const [loading, setLoading] = useState(!_cache);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (force = false) => {
    if (!force && _cache && Date.now() - _cacheTime < CACHE_TTL) {
      setData(_cache);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke("getDashboard", {});
      // invoke retorna direto o objeto { estatisticas, pedidos }
      _cache = response;
      _cacheTime = Date.now();
      setData(_cache);
    } catch (err) {
      setError(err.message || "Erro ao buscar dados do Sankhya");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // pedidos é um mapa { numeroPedido: { numeroOp: opData } }
  // Retorna também um helper para buscar OP por número de pedido
  const getOpsByPedido = useCallback((numeroPedido) => {
    if (!data?.pedidos || !numeroPedido) return [];
    const key = String(numeroPedido);
    const pedidoOps = data.pedidos[key];
    if (!pedidoOps) return [];
    return Object.values(pedidoOps);
  }, [data]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(true),
    getOpsByPedido,
    estatisticas: data?.estatisticas || null,
    pedidos: data?.pedidos || {},
  };
}