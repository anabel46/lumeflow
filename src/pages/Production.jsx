import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Play, Pause, ChevronRight } from "lucide-react";
import { format, startOfWeek, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, SECTOR_LABELS } from "@/lib/constants";

export default function Production() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [weekFilter, setWeekFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: productionOrders = [], isLoading } = useQuery({
    queryKey: ["production-orders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 500),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductionOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["production-orders"] }),
  });

  const startProduction = (po) => {
    updateMutation.mutate({
      id: po.id,
      data: { status: "em_producao", started_at: new Date().toISOString() },
    });
  };

  const pauseProduction = (po) => {
    updateMutation.mutate({ id: po.id, data: { status: "pausado" } });
  };

  // Generate week options
  const now = new Date();
  const weeks = [];
  for (let i = -2; i <= 6; i++) {
    const weekStart = startOfWeek(addWeeks(now, i), { weekStartsOn: 1 });
    const label = format(weekStart, "'Semana' dd/MM", { locale: ptBR });
    const value = format(weekStart, "yyyy-'W'ww");
    weeks.push({ label, value });
  }

  const filtered = productionOrders.filter(po => {
    const matchSearch = !search || po.unique_number?.toLowerCase().includes(search.toLowerCase())
      || po.product_name?.toLowerCase().includes(search.toLowerCase())
      || po.order_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || po.status === statusFilter;
    const matchWeek = weekFilter === "all" || po.planned_week === weekFilter;
    return matchSearch && matchStatus && matchWeek;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Produção</h1>
        <p className="text-sm text-muted-foreground">Planejamento e controle de ordens de produção</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="planejamento">Planejamento</SelectItem>
            <SelectItem value="em_producao">Em Produção</SelectItem>
            <SelectItem value="pausado">Pausado</SelectItem>
            <SelectItem value="finalizado">Finalizado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={weekFilter} onValueChange={setWeekFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Semana" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Semanas</SelectItem>
            {weeks.map(w => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center p-8 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground">Nenhuma ordem de produção encontrada</div>
        ) : (
          filtered.map((po) => (
            <div key={po.id} className="bg-card rounded-2xl border p-4 hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-semibold">{po.unique_number}</span>
                    <span className="text-xs text-muted-foreground">Pedido: {po.order_number}</span>
                  </div>
                  <p className="font-semibold mt-1">{po.product_name} {po.color && <span className="text-muted-foreground font-normal">- {po.color}</span>}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Ref: {po.reference}</span>
                    <span className="text-xs text-muted-foreground">Qtd: {po.quantity}</span>
                    {po.delivery_deadline && (
                      <span className={cn("text-xs", new Date(po.delivery_deadline) < now ? "text-red-500 font-semibold" : "text-muted-foreground")}>
                        Prazo: {format(new Date(po.delivery_deadline), "dd/MM/yyyy")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Production Sequence Progress */}
                <div className="flex items-center gap-1 flex-wrap">
                  {po.production_sequence?.map((sector, i) => (
                    <React.Fragment key={i}>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] whitespace-nowrap",
                          i < po.current_step_index ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                          i === po.current_step_index && po.status === "em_producao" ? "bg-blue-100 text-blue-700 border-blue-200 ring-2 ring-blue-300" :
                          "bg-muted text-muted-foreground"
                        )}
                      >
                        {SECTOR_LABELS[sector]?.substring(0, 8) || sector}
                      </Badge>
                      {i < po.production_sequence.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[po.status])}>
                    {STATUS_LABELS[po.status]}
                  </Badge>
                  {po.status === "planejamento" && (
                    <Button size="sm" variant="outline" onClick={() => startProduction(po)} className="gap-1">
                      <Play className="w-3 h-3" /> Iniciar
                    </Button>
                  )}
                  {po.status === "em_producao" && (
                    <Button size="sm" variant="outline" onClick={() => pauseProduction(po)} className="gap-1">
                      <Pause className="w-3 h-3" /> Pausar
                    </Button>
                  )}
                  {po.status === "pausado" && (
                    <Button size="sm" variant="outline" onClick={() => startProduction(po)} className="gap-1">
                      <Play className="w-3 h-3" /> Retomar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}