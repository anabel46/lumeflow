import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

export function useSankhyaDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke("getDashboard", {});
      setData(response.data);
    } catch (err) {
      setError(err.message || "Erro ao buscar dashboard Sankhya");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}