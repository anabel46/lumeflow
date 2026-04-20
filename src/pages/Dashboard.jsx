import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Factory, ClipboardList, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import SectorChart from "@/components/dashboard/SectorChart";
import DeadlineChart from "@/components/dashboard/DeadlineChart";
import CompletionStats from "@/components/dashboard/CompletionStats";
import SectorTodoChart from "@/components/dashboard/SectorTodoChart";
import DailyCompletionChart from "@/components/dashboard/DailyCompletionChart";
import MonthlyOrderStats from "@/components/dashboard/MonthlyOrderStats";
import PeriodSummary from "@/components/dashboard/PeriodSummary";
import EfficiencyChart from "@/components/dashboard/EfficiencyChart";
import OEEIndicator from "@/components/dashboard/OEEIndicator";
import SectorAverageTime from "@/components/dashboard/SectorAverageTime";
import TeamProductivity from "@/components/dashboard/TeamProductivity";
import BottleneckAnalysis from "@/components/dashboard/BottleneckAnalysis";
import SankhyaSection from "@/components/dashboard/SankhyaSection";

export default function Dashboard() {
  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-orders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 500),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => base44.entities.Order.list("-created_date", 500),
  });

  const now = new Date();
  const inProduction = productionOrders.filter(po => po.status === "em_producao").length;
  const totalOrders = orders.length;
  const overdue = productionOrders.filter(po =>
    po.status !== "finalizado" && po.delivery_deadline && new Date(po.delivery_deadline) < now
  ).length;
  const planning = productionOrders.filter(po => po.status === "planejamento").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da produção</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Em Produção" value={inProduction} icon={Factory} color="primary" subtitle="ordens ativas" />
        <StatCard title="Pedidos" value={totalOrders} icon={ClipboardList} color="purple" subtitle="total cadastrado" />
        <StatCard title="Atrasados" value={overdue} icon={AlertTriangle} color="danger" subtitle="fora do prazo" />
        <StatCard title="Planejamento" value={planning} icon={Clock} color="warning" subtitle="aguardando início" />
      </div>

      {/* Period Summary */}
      <PeriodSummary productionOrders={productionOrders} orders={orders} />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectorChart productionOrders={productionOrders} orders={orders} />
        <SectorTodoChart productionOrders={productionOrders} orders={orders} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeadlineChart productionOrders={productionOrders} orders={orders} />
        <DailyCompletionChart productionOrders={productionOrders} orders={orders} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CompletionStats productionOrders={productionOrders} />
        <MonthlyOrderStats orders={orders} productionOrders={productionOrders} />
      </div>

      {/* Efficiency Row */}
      <EfficiencyChart />

      {/* Analytics Dashboard */}
      <div className="pt-4 border-t">
        <h2 className="text-xl font-bold mb-6">Dashboard Analítico</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <OEEIndicator />
          <BottleneckAnalysis />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectorAverageTime />
          <TeamProductivity />
        </div>
      </div>

      {/* Sankhya Integration */}
      <div className="pt-4 border-t">
        <SankhyaSection />
      </div>
    </div>
  );
}