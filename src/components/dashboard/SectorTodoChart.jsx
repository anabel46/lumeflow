import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { SECTOR_LABELS, SECTORS } from "@/lib/constants";

export default function SectorTodoChart({ productionOrders }) {
  // Count items to fabricate per sector (all non-finished orders that have that sector in their sequence)
  const sectorCounts = {};
  (productionOrders || []).filter(po => po.status !== "finalizado").forEach((po) => {
    (po.production_sequence || []).forEach((sector, i) => {
      if (i >= (po.current_step_index ?? 0)) {
        sectorCounts[sector] = (sectorCounts[sector] || 0) + (po.quantity || 1);
      }
    });
  });

  const data = SECTORS
    .filter(s => sectorCounts[s.id])
    .map(s => ({ name: SECTOR_LABELS[s.id] || s.id, itens: sectorCounts[s.id] }));

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-2xl border p-6">
        <h3 className="text-sm font-semibold mb-1">Itens a Fabricar por Setor</h3>
        <p className="text-xs text-muted-foreground mb-4">Ordens pendentes em cada etapa</p>
        <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border p-6">
      <h3 className="text-sm font-semibold mb-1">Itens a Fabricar por Setor</h3>
      <p className="text-xs text-muted-foreground mb-4">Ordens pendentes em cada etapa</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
          />
          <Bar dataKey="itens" fill="hsl(var(--chart-4))" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}