import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";
import { cn } from "@/lib/utils";

const PERIODS = [
  { label: "Hoje", value: "today" },
  { label: "Últimos 7 dias", value: "7days" },
  { label: "Mês atual", value: "month" },
  { label: "Tudo", value: "all" },
];

function getPeriodStart(period) {
  const now = new Date();
  if (period === "today") return startOfDay(now);
  if (period === "7days") return subDays(now, 7);
  if (period === "month") return startOfMonth(now);
  return new Date(0);
}

export default function PeriodSummary({ productionOrders, orders }) {
  const [period, setPeriod] = useState("month");
  const now = new Date();
  const periodStart = getPeriodStart(period);

  const pos = (productionOrders || []).filter(po => {
    const created = new Date(po.created_date);
    return created >= periodStart;
  });

  // Unique order numbers in the period
  const uniqueOrders = new Set(pos.map(po => po.order_id).filter(Boolean)).size;
  const totalItems = pos.reduce((acc, po) => acc + (po.quantity || 1), 0);
  const overdue = pos.filter(po =>
    po.status !== "finalizado" && po.delivery_deadline && new Date(po.delivery_deadline) < now
  ).length;
  const onTime = pos.filter(po =>
    po.status !== "finalizado" && po.delivery_deadline && new Date(po.delivery_deadline) >= now
  ).length;
  const finished = pos.filter(po => po.status === "finalizado").length;

  const statItems = [
    { label: "Pedidos no período", value: uniqueOrders, color: "bg-blue-50 border-blue-100 text-blue-700" },
    { label: "Total de itens", value: totalItems, color: "bg-slate-50 border-slate-200 text-slate-700" },
    { label: "No prazo", value: onTime, color: "bg-emerald-50 border-emerald-100 text-emerald-700" },
    { label: "Fora do prazo", value: overdue, color: "bg-red-50 border-red-100 text-red-700" },
    { label: "Finalizados", value: finished, color: "bg-violet-50 border-violet-100 text-violet-700" },
  ];

  return (
    <div className="bg-card rounded-2xl border p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold">Resumo por Período</h3>
          <p className="text-xs text-muted-foreground">Ordens de produção no período selecionado</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {statItems.map(s => (
          <div key={s.label} className={cn("rounded-xl border p-4 text-center", s.color)}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-[11px] mt-1 font-medium opacity-80">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}