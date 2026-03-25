import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { SECTOR_LABELS } from "@/lib/constants";

export default function SectorChart({ productionOrders }) {
  const sectorCounts = {};
  (productionOrders || []).forEach((po) => {
    if (po.status === "em_producao" && po.current_sector) {
      sectorCounts[po.current_sector] = (sectorCounts[po.current_sector] || 0) + 1;
    }
  });

  const data = Object.entries(sectorCounts).map(([sector, count]) => ({
    name: SECTOR_LABELS[sector] || sector,
    quantidade: count,
  }));

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-2xl border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Produtos por Setor</h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          Nenhuma ordem em produção
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">Produtos por Setor</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
              fontSize: "12px"
            }}
          />
          <Bar dataKey="quantidade" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}