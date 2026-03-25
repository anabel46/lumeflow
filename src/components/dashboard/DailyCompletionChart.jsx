import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import DrillDownModal from "./DrillDownModal";

export default function DailyCompletionChart({ productionOrders, orders = [] }) {
  const [selected, setSelected] = useState(null);
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => subDays(now, 6 - i));

  const finished = (productionOrders || []).filter(po => po.status === "finalizado" && po.finished_at);

  const data = days.map(day => {
    const dayStr = format(day, "dd/MM");
    const dayLabel = format(day, "yyyy-MM-dd");
    const dayStart = startOfDay(day).getTime();
    const dayEnd = dayStart + 86400000;
    const pos = finished.filter(po => {
      const t = new Date(po.finished_at).getTime();
      return t >= dayStart && t < dayEnd;
    });
    return { dia: dayStr, dayLabel, finalizados: pos.length };
  });

  const dayMap = {};
  data.forEach(d => {
    const dayStart = startOfDay(new Date(d.dayLabel + "T00:00:00")).getTime();
    const dayEnd = dayStart + 86400000;
    dayMap[d.dia] = finished.filter(po => {
      const t = new Date(po.finished_at).getTime();
      return t >= dayStart && t < dayEnd;
    });
  });

  const selectedPOs = selected ? (dayMap[selected] || []) : [];

  return (
    <>
      <div className="bg-card rounded-2xl border p-6">
        <h3 className="text-sm font-semibold mb-1">OPs Finalizadas por Dia</h3>
        <p className="text-xs text-muted-foreground mb-4">Clique em uma barra para ver as OPs finalizadas</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} onClick={(e) => {
            if (e?.activePayload?.[0]) setSelected(e.activePayload[0].payload.dia);
          }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
              cursor={{ fill: "hsl(var(--muted))" }}
            />
            <Bar dataKey="finalizados" name="Finalizadas" radius={[6, 6, 0, 0]} style={{ cursor: "pointer" }}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.dia === selected ? "hsl(var(--chart-2))" : "hsl(var(--chart-2) / 0.7)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DrillDownModal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`OPs Finalizadas — ${selected}`}
        subtitle={`${selectedPOs.length} ordem(ns) concluída(s) neste dia`}
        productionOrders={selectedPOs}
        orders={orders}
      />
    </>
  );
}