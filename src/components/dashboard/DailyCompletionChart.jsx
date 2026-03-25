import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SECTOR_LABELS } from "@/lib/constants";

export default function DailyCompletionChart({ productionOrders }) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => subDays(now, 6 - i));

  // Items finished per day (by SectorLog would be ideal, but using finished_at on PO per sector via logs not available)
  // We'll use finished_at on production orders grouped by day
  const finished = (productionOrders || []).filter(po => po.status === "finalizado" && po.finished_at);

  const data = days.map(day => {
    const dayStr = format(day, "dd/MM");
    const dayStart = startOfDay(day).getTime();
    const dayEnd = dayStart + 86400000;
    const count = finished.filter(po => {
      const t = new Date(po.finished_at).getTime();
      return t >= dayStart && t < dayEnd;
    }).length;
    return { dia: dayStr, finalizados: count };
  });

  return (
    <div className="bg-card rounded-2xl border p-6">
      <h3 className="text-sm font-semibold mb-1">OPs Finalizadas por Dia</h3>
      <p className="text-xs text-muted-foreground mb-4">Últimos 7 dias</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
          />
          <Bar dataKey="finalizados" name="Finalizadas" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}