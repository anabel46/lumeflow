import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { SECTOR_LABELS } from "@/lib/constants";
import DrillDownModal from "./DrillDownModal";

export default function SectorChart({ productionOrders, orders = [] }) {
  const [selected, setSelected] = useState(null);

  const sectorMap = {};
  (productionOrders || []).forEach((po) => {
    if (po.status === "em_producao" && po.current_sector) {
      if (!sectorMap[po.current_sector]) sectorMap[po.current_sector] = [];
      sectorMap[po.current_sector].push(po);
    }
  });

  const data = Object.entries(sectorMap).map(([sector, pos]) => ({
    name: SECTOR_LABELS[sector] || sector,
    sectorKey: sector,
    quantidade: pos.length,
  }));

  const selectedPOs = selected ? (sectorMap[selected] || []) : [];

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
    <>
      <div className="bg-card rounded-2xl border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Produtos por Setor</h3>
        <p className="text-xs text-muted-foreground mb-4">Clique em uma barra para ver as OPs</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} onClick={(e) => {
            if (e?.activePayload?.[0]) setSelected(e.activePayload[0].payload.sectorKey);
          }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
              cursor={{ fill: "hsl(var(--muted))" }}
            />
            <Bar dataKey="quantidade" radius={[6, 6, 0, 0]} style={{ cursor: "pointer" }}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.sectorKey === selected ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.7)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DrillDownModal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Setor: ${SECTOR_LABELS[selected] || selected}`}
        subtitle={`${selectedPOs.length} ordem(ns) em produção`}
        productionOrders={selectedPOs}
        orders={orders}
      />
    </>
  );
}