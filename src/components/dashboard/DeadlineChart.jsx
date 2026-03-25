import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const COLORS = ["hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)"];

export default function DeadlineChart({ productionOrders }) {
  const now = new Date();
  let onTime = 0, nearDeadline = 0, overdue = 0;

  (productionOrders || []).filter(po => po.status === "em_producao").forEach((po) => {
    if (!po.delivery_deadline) { onTime++; return; }
    const deadline = new Date(po.delivery_deadline);
    const diffDays = (deadline - now) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) overdue++;
    else if (diffDays < 3) nearDeadline++;
    else onTime++;
  });

  const data = [
    { name: "No Prazo", value: onTime },
    { name: "Próximo", value: nearDeadline },
    { name: "Atrasado", value: overdue },
  ].filter(d => d.value > 0);

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
    <div className="bg-card rounded-2xl border p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">Prazos de Entrega</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
              fontSize: "12px"
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}