import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import DrillDownModal from "./DrillDownModal";

const COLORS = ["hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)"];

export default function DeadlineChart({ productionOrders, orders = [] }) {
  const [selected, setSelected] = useState(null);
  const now = new Date();

  const groups = { "No Prazo": [], "Próximo": [], "Atrasado": [] };

  (productionOrders || []).filter(po => po.status === "em_producao").forEach((po) => {
    if (!po.delivery_deadline) { groups["No Prazo"].push(po); return; }
    const diffDays = (new Date(po.delivery_deadline) - now) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) groups["Atrasado"].push(po);
    else if (diffDays < 3) groups["Próximo"].push(po);
    else groups["No Prazo"].push(po);
  });

  const data = [
    { name: "No Prazo", value: groups["No Prazo"].length },
    { name: "Próximo", value: groups["Próximo"].length },
    { name: "Atrasado", value: groups["Atrasado"].length },
  ].filter(d => d.value > 0);

  const selectedPOs = selected ? (groups[selected] || []) : [];

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-2xl border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Prazos de Entrega</h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          Nenhuma ordem em produção
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-2xl border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Prazos de Entrega</h3>
        <p className="text-xs text-muted-foreground mb-4">Clique em um segmento para ver as OPs</p>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart onClick={(e) => {
            if (e?.activePayload?.[0]) setSelected(e.activePayload[0].payload.name);
          }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={5}
              dataKey="value"
              style={{ cursor: "pointer" }}
            >
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={COLORS[i % COLORS.length]}
                  opacity={selected && selected !== entry.name ? 0.5 : 1}
                  stroke={selected === entry.name ? "#fff" : "none"}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <DrillDownModal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Prazos — ${selected}`}
        subtitle={`${selectedPOs.length} ordem(ns) nesta categoria`}
        productionOrders={selectedPOs}
        orders={orders}
      />
    </>
  );
}