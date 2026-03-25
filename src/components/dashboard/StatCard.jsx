import React from "react";
import { cn } from "@/lib/utils";

export default function StatCard({ title, value, subtitle, icon: Icon, trend, color = "primary" }) {
  const colors = {
    primary: "from-blue-500 to-blue-600",
    success: "from-emerald-500 to-emerald-600",
    warning: "from-amber-500 to-amber-600",
    danger: "from-red-500 to-red-600",
    purple: "from-violet-500 to-violet-600",
  };

  return (
    <div className="bg-card rounded-2xl border p-5 hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold mt-2 text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={cn("w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform", colors[color])}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      {trend && (
        <div className={cn("mt-3 text-xs font-medium", trend > 0 ? "text-emerald-600" : "text-red-500")}>
          {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% vs semana anterior
        </div>
      )}
    </div>
  );
}