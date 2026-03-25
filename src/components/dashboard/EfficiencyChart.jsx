import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { SECTOR_LABELS } from "@/lib/constants";
import { TrendingUp } from "lucide-react";

export default function EfficiencyChart() {
  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => base44.entities.ProductionAppointment.list("-date", 500),
  });

  if (appointments.length === 0) {
    return (
      <div className="bg-card rounded-2xl border p-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Eficiência por Setor
        </h3>
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum apontamento registrado ainda</p>
      </div>
    );
  }

  // Aggregate efficiency by sector
  const bySector = {};
  for (const a of appointments) {
    if (!a.sector) continue;
    if (!bySector[a.sector]) bySector[a.sector] = { work: 0, downtime: 0, produced: 0, count: 0 };
    bySector[a.sector].work += a.work_time_minutes || 0;
    bySector[a.sector].downtime += a.downtime_minutes || 0;
    bySector[a.sector].produced += a.quantity_produced || 0;
    bySector[a.sector].count += 1;
  }

  const data = Object.entries(bySector)
    .map(([sector, stats]) => ({
      sector: SECTOR_LABELS[sector] || sector,
      efficiency: stats.work + stats.downtime > 0
        ? Math.round((stats.work / (stats.work + stats.downtime)) * 100)
        : 100,
      produced: stats.produced,
    }))
    .sort((a, b) => b.efficiency - a.efficiency);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold mb-1">{label}</p>
        <p>Eficiência: <strong className="text-primary">{payload[0]?.value}%</strong></p>
        <p className="text-muted-foreground">Produzido: {payload[0]?.payload?.produced} itens</p>
      </div>
    );
  };

  const getBarColor = (efficiency) => efficiency >= 90 ? "#10b981" : efficiency >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <div className="bg-card rounded-2xl border p-6">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" /> Eficiência por Setor (Apontamentos)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="sector"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="%" />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={90} stroke="#10b981" strokeDasharray="4 4" label={{ value: "Meta 90%", fontSize: 9, fill: "#10b981" }} />
          <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Mín 70%", fontSize: 9, fill: "#f59e0b" }} />
          <Bar dataKey="efficiency" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))"
            shape={(props) => {
              const { x, y, width, height, value } = props;
              return <rect x={x} y={y} width={width} height={height} rx={4} fill={getBarColor(value)} />;
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}