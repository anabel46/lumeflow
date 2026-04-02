import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Clock, AlertCircle } from "lucide-react";
import { SECTOR_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function SectorAverageTime() {
  const { data: logs = [] } = useQuery({
    queryKey: ["sector-logs-avg"],
    queryFn: () => base44.entities.SectorLog.list("-created_date", 1000),
  });

  const sectorTimes = useMemo(() => {
    const sectorMap = {};

    logs
      .filter(log => log.action === "saida" && log.started_at && log.finished_at)
      .forEach(log => {
        if (!sectorMap[log.sector]) {
          sectorMap[log.sector] = { times: [], count: 0 };
        }

        const start = new Date(log.started_at).getTime();
        const end = new Date(log.finished_at).getTime();
        const durationMinutes = Math.round((end - start) / (1000 * 60));

        if (durationMinutes > 0 && durationMinutes < 10080) { // Less than 7 days
          sectorMap[log.sector].times.push(durationMinutes);
          sectorMap[log.sector].count++;
        }
      });

    const sectors = Object.entries(sectorMap)
      .map(([sectorId, data]) => {
        const avgTime = Math.round(data.times.reduce((a, b) => a + b, 0) / data.times.length);
        return {
          id: sectorId,
          label: SECTOR_LABELS[sectorId] || sectorId,
          avgTime,
          count: data.count,
        };
      })
      .sort((a, b) => b.avgTime - a.avgTime);

    return sectors;
  }, [logs]);

  const maxTime = sectorTimes.length > 0 ? Math.max(...sectorTimes.map(s => s.avgTime)) : 100;

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Clock className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold">Tempo Médio por Setor</h3>
          <p className="text-xs text-muted-foreground">Duração média de produção</p>
        </div>
      </div>

      {sectorTimes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="w-5 h-5 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Dados insuficientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sectorTimes.slice(0, 6).map((sector) => (
            <div key={sector.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{sector.label}</span>
                <span className={cn(
                  "text-xs font-bold",
                  sector.avgTime > maxTime * 0.7 ? "text-amber-600" : "text-emerald-600"
                )}>
                  {sector.avgTime}m
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    sector.avgTime > maxTime * 0.7 ? "bg-amber-500" : "bg-blue-500"
                  )}
                  style={{ width: `${(sector.avgTime / maxTime) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{sector.count} apontamentos</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}