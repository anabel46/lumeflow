import React from "react";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";

export default function CompletionStats({ productionOrders }) {
  const now = new Date();
  const finished = (productionOrders || []).filter(po => po.status === "finalizado" && po.finished_at);

  const countSince = (date) => finished.filter(po => new Date(po.finished_at) >= date).length;

  const stats = [
    { label: "Hoje", value: countSince(startOfDay(now)) },
    { label: "Semana", value: countSince(startOfWeek(now, { weekStartsOn: 1 })) },
    { label: "Mês", value: countSince(startOfMonth(now)) },
    { label: "Ano", value: countSince(startOfYear(now)) },
  ];

  return (
    <div className="bg-card rounded-2xl border p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">Pedidos Finalizados</h3>
      <div className="grid grid-cols-2 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center p-4 bg-muted/50 rounded-xl">
            <p className="text-3xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}