import React from "react";
import { ShoppingCart, CheckCircle2, Truck } from "lucide-react";
import { startOfMonth } from "date-fns";

export default function MonthlyOrderStats({ orders, productionOrders }) {
  const now = new Date();
  const monthStart = startOfMonth(now);

  // Pedidos vendidos no mês (criados no mês)
  const soldThisMonth = (orders || []).filter(o => new Date(o.created_date) >= monthStart).length;

  // Pedidos finalizados no mês (status finalizado com updated_date no mês)
  const finishedThisMonth = (orders || []).filter(o =>
    o.status === "finalizado" && new Date(o.updated_date) >= monthStart
  ).length;

  // OPs finalizadas no mês (entregues = finalizado)
  const opsFinishedThisMonth = (productionOrders || []).filter(po =>
    po.status === "finalizado" && po.finished_at && new Date(po.finished_at) >= monthStart
  ).length;

  const stats = [
    {
      label: "Pedidos vendidos no mês",
      value: soldThisMonth,
      icon: ShoppingCart,
      color: "bg-blue-50 text-blue-600 border-blue-100",
      iconBg: "bg-blue-100",
    },
    {
      label: "Pedidos entregues no mês",
      value: finishedThisMonth,
      icon: Truck,
      color: "bg-emerald-50 text-emerald-700 border-emerald-100",
      iconBg: "bg-emerald-100",
    },
    {
      label: "OPs concluídas no mês",
      value: opsFinishedThisMonth,
      icon: CheckCircle2,
      color: "bg-violet-50 text-violet-700 border-violet-100",
      iconBg: "bg-violet-100",
    },
  ];

  return (
    <div className="bg-card rounded-2xl border p-6">
      <h3 className="text-sm font-semibold mb-1">Resumo do Mês</h3>
      <p className="text-xs text-muted-foreground mb-4">Mês atual</p>
      <div className="space-y-3">
        {stats.map(s => (
          <div key={s.label} className={`flex items-center gap-4 rounded-xl border p-4 ${s.color}`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.iconBg}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium opacity-80">{s.label}</p>
            </div>
            <p className="text-3xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}