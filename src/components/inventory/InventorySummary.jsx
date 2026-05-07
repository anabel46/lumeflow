import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle2, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InventorySummary({ items, stats, session }) {
  const divergentItems = items.filter(i => i.status === "divergente");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Stats Cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Resumo da Contagem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total de itens</span>
            <Badge variant="outline" className="font-medium">{stats.total}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Itens contados</span>
            <Badge variant="outline" className="font-medium bg-blue-50 text-blue-700">{stats.counted}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Itens OK</span>
            <Badge variant="outline" className="font-medium bg-emerald-50 text-emerald-700">{stats.ok}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Itens divergentes</span>
            <Badge variant="outline" className={cn("font-medium", stats.divergent > 0 ? "bg-amber-50 text-amber-700" : "")}>
              {stats.divergent}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Itens pendentes</span>
            <Badge variant="outline" className="font-medium bg-slate-50 text-slate-700">{stats.pending}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Divergent Items List */}
      {divergentItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              Divergências Encontradas ({divergentItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {divergentItems.map((item) => {
              const diff = (item.quantity_revised || 0) - (item.quantity_current || 0);
              return (
                <div key={item.id} className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-medium">{item.item_code}</span>
                    <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700">
                      {diff > 0 ? "+" : ""}{diff}
                    </Badge>
                  </div>
                  <p className="font-medium truncate">{item.item_name}</p>
                  <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                    <span>Sistema: <strong className="text-foreground">{item.quantity_current}</strong></span>
                    <span>•</span>
                    <span>Contado: <strong className="text-foreground">{item.quantity_revised}</strong></span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}