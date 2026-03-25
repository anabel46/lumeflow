import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { SECTOR_LABELS, SECTORS } from "@/lib/constants";
import DrillDownModal from "./DrillDownModal";

export default function SectorTodoChart({ productionOrders, orders = [] }) {
  const [selected, setSelected] = useState(null);

  const sectorMap = {};
  (productionOrders || []).filter(po => po.status !== "finalizado").forEach((po) => {
    (po.production_sequence || []).forEach((sector, i) => {
      if (i >= (po.current_step_index ?? 0)) {
        if (!sectorMap[sector]) sectorMap[sector] = [];
        if (!sectorMap[sector].includes(po)) sectorMap[sector].push(po);
      }
    });
  });

  const data = SECTORS
    .filter(s => sectorMap[s.id]?.length)
    .map(s => ({
      name: SECTOR_LABELS[s.id] || s.id,
      sectorKey: s.id,
      itens: sectorMap[s.id].reduce((acc, po) => acc + (po.quantity || 1), 0),
      ops: sectorMap[s.id].length,
    }));

  const selectedPOs = selected ? (sectorMap[selected] || []) : [];

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
    <>
      <div className="bg-card rounded-2xl border p-6">
        <h3 className="text-sm font-semibold mb-1">Itens a Fabricar por Setor</h3>
        <p className="text-xs text-muted-foreground mb-4">Clique em uma barra para ver as OPs pendentes</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} onClick={(e) => {
            if (e?.activePayload?.[0]) setSelected(e.activePayload[0].payload.sectorKey);
          }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
              formatter={(value, name, props) => [`${value} itens (${props.payload.ops} OPs)`, "Pendente"]}
              cursor={{ fill: "hsl(var(--muted))" }}
            />
            <Bar dataKey="itens" radius={[6, 6, 0, 0]} style={{ cursor: "pointer" }}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.sectorKey === selected ? "hsl(var(--chart-4))" : "hsl(var(--chart-4) / 0.7)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DrillDownModal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Pendentes: ${SECTOR_LABELS[selected] || selected}`}
        subtitle={`${selectedPOs.length} OP(s) aguardando ou em andamento neste setor`}
        productionOrders={selectedPOs}
        orders={orders}
      />
    </>
  );
}