import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OEEIndicator() {
  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-orders-oee"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 500),
  });

  const { data: qualityChecks = [] } = useQuery({
    queryKey: ["quality-checks-oee"],
    queryFn: () => base44.entities.QualityCheck.list("-created_date", 500),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["sector-logs-oee"],
    queryFn: () => base44.entities.SectorLog.list("-created_date", 500),
  });

  const oeeData = useMemo(() => {
    // Últimas 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentOrders = productionOrders.filter(po => {
      const created = po.created_date ? new Date(po.created_date) : new Date();
      return created >= thirtyDaysAgo;
    });

    if (recentOrders.length === 0) {
      return { availability: 0, performance: 0, quality: 0, oee: 0 };
    }

    // Availability: % de tempo produtivo vs pausado
    const totalOrders = recentOrders.length;
    const finishedOrders = recentOrders.filter(po => po.status === "finalizado").length;
    const pausedOrders = recentOrders.filter(po => po.status === "pausado").length;
    const availability = Math.round(((totalOrders - pausedOrders) / totalOrders) * 100);

    // Performance: velocidade de conclusão
    const completedThisMonth = recentOrders.filter(po => po.status === "finalizado").length;
    const performance = Math.min(100, Math.round((completedThisMonth / totalOrders) * 100 * 1.2));

    // Quality: taxa de aprovação no controle de qualidade
    const recentChecks = qualityChecks.filter(qc => {
      const created = qc.created_date ? new Date(qc.created_date) : new Date();
      return created >= thirtyDaysAgo;
    });
    const approvedChecks = recentChecks.filter(qc => qc.overall_result === "aprovado").length;
    const quality = recentChecks.length > 0 ? Math.round((approvedChecks / recentChecks.length) * 100) : 100;

    // OEE = Availability × Performance × Quality
    const oee = Math.round((availability * performance * quality) / 10000);

    return { availability, performance, quality, oee };
  }, [productionOrders, qualityChecks]);

  const getOeeColor = (value) => {
    if (value >= 85) return "text-emerald-600";
    if (value >= 70) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">OEE (Eficiência Global)</h3>
          <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-[11px] text-muted-foreground mb-1">Disponibilidade</p>
          <p className="text-2xl font-bold">{oeeData.availability}%</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-[11px] text-muted-foreground mb-1">Desempenho</p>
          <p className="text-2xl font-bold">{oeeData.performance}%</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-[11px] text-muted-foreground mb-1">Qualidade</p>
          <p className="text-2xl font-bold">{oeeData.quality}%</p>
        </div>
        <div className="bg-primary/10 rounded-lg p-3">
          <p className="text-[11px] text-muted-foreground mb-1">OEE Final</p>
          <p className={cn("text-2xl font-bold", getOeeColor(oeeData.oee))}>{oeeData.oee}%</p>
        </div>
      </div>

      <div className="bg-muted/40 rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-2">Meta: 85%</p>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              oeeData.oee >= 85 ? "bg-emerald-500" : oeeData.oee >= 70 ? "bg-amber-500" : "bg-red-500"
            )}
            style={{ width: `${Math.min(oeeData.oee, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}