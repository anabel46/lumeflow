import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TeamProductivity() {
  const { data: logs = [] } = useQuery({
    queryKey: ["sector-logs-team"],
    queryFn: () => base44.entities.SectorLog.list("-created_date", 1000),
  });

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-orders-team"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 500),
  });

  const teamStats = useMemo(() => {
    // Últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const operatorMap = {};

    logs
      .filter(log => log.operator && log.action === "saida")
      .filter(log => {
        const created = log.created_date ? new Date(log.created_date) : new Date();
        return created >= thirtyDaysAgo;
      })
      .forEach(log => {
        if (!operatorMap[log.operator]) {
          operatorMap[log.operator] = { count: 0, rating: 0, totalRating: 0 };
        }
        operatorMap[log.operator].count++;
        if (log.rating) {
          operatorMap[log.operator].totalRating += log.rating;
          operatorMap[log.operator].rating = Math.round(operatorMap[log.operator].totalRating / operatorMap[log.operator].count);
        }
      });

    const operators = Object.entries(operatorMap)
      .map(([name, data]) => ({
        name,
        completions: data.count,
        avgRating: data.rating || 0,
      }))
      .sort((a, b) => b.completions - a.completions);

    // KPIs
    const totalCompleted = productionOrders.filter(po => po.status === "finalizado").length;
    const avgCompletionsPerOperator = operators.length > 0
      ? Math.round(operators.reduce((sum, op) => sum + op.completions, 0) / operators.length)
      : 0;

    return { operators: operators.slice(0, 5), totalCompleted, avgCompletionsPerOperator };
  }, [logs, productionOrders]);

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-semibold">Produtividade da Equipe</h3>
          <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-[11px] text-muted-foreground mb-1">Total Concluídos</p>
          <p className="text-2xl font-bold">{teamStats.totalCompleted}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-[11px] text-muted-foreground mb-1">Média por Op.</p>
          <p className="text-2xl font-bold">{teamStats.avgCompletionsPerOperator}</p>
        </div>
      </div>

      {teamStats.operators.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <AlertCircle className="w-4 h-4 mx-auto mb-1 opacity-50" />
          <p className="text-sm">Dados insuficientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teamStats.operators.map((operator) => (
            <div key={operator.name} className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">{operator.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary">{operator.completions} OP(s)</span>
                  {operator.avgRating > 0 && (
                    <span className="text-[11px] text-amber-600 font-semibold">★ {operator.avgRating}</span>
                  )}
                </div>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${(operator.completions / teamStats.operators[0].completions) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}