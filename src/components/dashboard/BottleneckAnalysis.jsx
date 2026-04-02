import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, TrendingDown } from "lucide-react";
import { SECTOR_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function BottleneckAnalysis() {
  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-orders-bottleneck"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 500),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["sector-logs-bottleneck"],
    queryFn: () => base44.entities.SectorLog.list("-created_date", 1000),
  });

  const { data: qualityChecks = [] } = useQuery({
    queryKey: ["quality-checks-bottleneck"],
    queryFn: () => base44.entities.QualityCheck.list("-created_date", 500),
  });

  const bottlenecks = useMemo(() => {
    const issues = [];

    // 1. Identificar setores com muitas OPs aguardando (gargalo de capacidade)
    const sectorWaiting = {};
    productionOrders.forEach(po => {
      if (po.current_sector && po.sector_status === "aguardando") {
        sectorWaiting[po.current_sector] = (sectorWaiting[po.current_sector] || 0) + 1;
      }
    });

    Object.entries(sectorWaiting).forEach(([sector, count]) => {
      if (count >= 3) {
        issues.push({
          type: "capacity",
          sector,
          severity: count >= 5 ? "high" : "medium",
          title: `${SECTOR_LABELS[sector] || sector}`,
          description: `${count} OP(s) aguardando`,
          count,
        });
      }
    });

    // 2. Identificar setores com maior tempo médio (lentidão)
    const sectorDuration = {};
    logs
      .filter(log => log.action === "saida" && log.started_at && log.finished_at)
      .forEach(log => {
        if (!sectorDuration[log.sector]) {
          sectorDuration[log.sector] = [];
        }
        const start = new Date(log.started_at).getTime();
        const end = new Date(log.finished_at).getTime();
        const minutes = (end - start) / (1000 * 60);
        if (minutes > 0 && minutes < 10080) {
          sectorDuration[log.sector].push(minutes);
        }
      });

    const avgDurations = Object.entries(sectorDuration).map(([sector, times]) => ({
      sector,
      avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    }));

    const overallAvg = avgDurations.length > 0
      ? Math.round(avgDurations.reduce((sum, s) => sum + s.avg, 0) / avgDurations.length)
      : 0;

    avgDurations.forEach(({ sector, avg }) => {
      if (avg > overallAvg * 1.5) {
        issues.push({
          type: "slowness",
          sector,
          severity: avg > overallAvg * 2 ? "high" : "medium",
          title: `${SECTOR_LABELS[sector] || sector}`,
          description: `Tempo médio ${avg}m (${Math.round(((avg / overallAvg) - 1) * 100)}% acima)`,
          value: avg,
        });
      }
    });

    // 3. Identificar setores com maior taxa de retrabalho
    const retrabalhoBySector = {};
    logs
      .filter(log => log.action === "retrabalho")
      .forEach(log => {
        retrabalhoBySector[log.sector] = (retrabalhoBySector[log.sector] || 0) + 1;
      });

    Object.entries(retrabalhoBySector).forEach(([sector, count]) => {
      if (count >= 2) {
        issues.push({
          type: "rework",
          sector,
          severity: count >= 4 ? "high" : "medium",
          title: `${SECTOR_LABELS[sector] || sector}`,
          description: `${count} retrabalho(s) identificado(s)`,
          count,
        });
      }
    });

    return issues.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [productionOrders, logs]);

  const getIcon = (type) => {
    if (type === "capacity") return "📦";
    if (type === "slowness") return "⏱️";
    if (type === "rework") return "🔄";
    return "⚠️";
  };

  const getLabel = (type) => {
    if (type === "capacity") return "Capacidade";
    if (type === "slowness") return "Lentidão";
    if (type === "rework") return "Retrabalho";
    return "Outro";
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h3 className="font-semibold">Gargalos Identificados</h3>
          <p className="text-xs text-muted-foreground">Problemas críticos no fluxo</p>
        </div>
      </div>

      {bottlenecks.length === 0 ? (
        <div className="text-center py-8">
          <TrendingDown className="w-6 h-6 mx-auto mb-2 text-emerald-600 opacity-50" />
          <p className="text-sm text-muted-foreground">Nenhum gargalo identificado</p>
          <p className="text-xs text-emerald-600 font-medium mt-2">✓ Fluxo produtivo em bom estado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bottlenecks.slice(0, 5).map((issue, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-lg border p-3 flex items-start gap-3",
                issue.severity === "high"
                  ? "bg-red-50/50 border-red-200"
                  : "bg-amber-50/50 border-amber-200"
              )}
            >
              <span className="text-lg mt-0.5">{getIcon(issue.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium text-sm">{issue.title}</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] py-0 px-1.5",
                      issue.severity === "high"
                        ? "bg-red-100 text-red-700 border-red-200"
                        : "bg-amber-100 text-amber-700 border-amber-200"
                    )}
                  >
                    {issue.severity === "high" ? "Crítico" : "Atenção"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{issue.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}