import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Play, Pause, ChevronRight, AlertTriangle, Clock, Package, Store, MapPin, Calendar } from "lucide-react";
import { format, startOfWeek, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, SECTOR_LABELS } from "@/lib/constants";
import { Link } from "react-router-dom";

const STATUS_TABS = [
  { value: "all", label: "Todos" },
  { value: "planejamento", label: "Planejamento" },
  { value: "em_producao", label: "Em Produção" },
  { value: "pausado", label: "Pausado" },
  { value: "finalizado", label: "Finalizado" },
];

function ProgressBar({ sequence = [], currentIndex = 0, status, sectorStatus }) {
  const total = sequence.length;
  if (!total) return null;
  const pct = status === "finalizado" ? 100 : Math.round((currentIndex / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", status === "finalizado" ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
    </div>
  );
}

function POCard({ po, onStart, onPause, now }) {
  const isOverdue = po.delivery_deadline && new Date(po.delivery_deadline) < now && po.status !== "finalizado";
  const currentSectorLabel = po.current_sector ? SECTOR_LABELS[po.current_sector] : null;

  return (
    <div className={cn(
      "bg-card rounded-xl border p-4 hover:shadow-md transition-all group",
      isOverdue && "border-red-200 bg-red-50/20",
      po.status === "finalizado" && "opacity-70"
    )}>
      <div className="flex flex-col gap-3">
        {/* Row 1: Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold shrink-0">{po.unique_number}</span>
            <Link to={`/pedidos/${po.order_id}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Pedido #{po.order_number}
            </Link>
            {po.is_intermediate && (
              <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700 gap-0.5 shrink-0">
                <Package className="w-2.5 h-2.5" />Inter.
              </Badge>
            )}
            {isOverdue && (
              <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 gap-0.5 shrink-0">
                <AlertTriangle className="w-2.5 h-2.5" />Atrasado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[po.status])}>
              {STATUS_LABELS[po.status]}
            </Badge>
            {po.status === "planejamento" && (
              <Button size="sm" variant="outline" onClick={() => onStart(po)} className="h-7 px-2.5 gap-1 text-xs">
                <Play className="w-3 h-3" /> Iniciar
              </Button>
            )}
            {po.status === "em_producao" && (
              <Button size="sm" variant="outline" onClick={() => onPause(po)} className="h-7 px-2.5 gap-1 text-xs">
                <Pause className="w-3 h-3" /> Pausar
              </Button>
            )}
            {po.status === "pausado" && (
              <Button size="sm" variant="outline" onClick={() => onStart(po)} className="h-7 px-2.5 gap-1 text-xs text-amber-600 border-amber-300">
                <Play className="w-3 h-3" /> Retomar
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Product info */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{po.product_name}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
              {po.reference && <span className="font-mono">{po.reference}</span>}
              <span>Qtd: <strong className="text-foreground">{po.quantity}</strong></span>
              {po.color && <span>Cor: <strong className="text-foreground">{po.color}</strong></span>}
              {po.cost_center && (
                <span className="flex items-center gap-0.5"><Store className="w-3 h-3" />{po.cost_center}</span>
              )}
              {po.environment && (
                <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{po.environment}</span>
              )}
              {po.delivery_deadline && (
                <span className={cn("flex items-center gap-0.5", isOverdue ? "text-red-500 font-semibold" : "")}>
                  <Calendar className="w-3 h-3" />
                  {format(new Date(po.delivery_deadline), "dd/MM/yyyy")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Progress */}
        <ProgressBar
          sequence={po.production_sequence}
          currentIndex={po.current_step_index ?? 0}
          status={po.status}
          sectorStatus={po.sector_status}
        />

        {/* Row 4: Sector pills — scrollable horizontal */}
        {po.production_sequence?.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            {po.production_sequence.map((sector, i) => {
              const isDone = i < (po.current_step_index ?? 0);
              const isCurrent = i === (po.current_step_index ?? 0) && po.status === "em_producao";
              const isInProgress = isCurrent && po.sector_status === "em_producao";
              return (
                <React.Fragment key={i}>
                  <Link to={`/setor/${sector}`}>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity shrink-0",
                        isDone ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                        isInProgress ? "bg-blue-100 text-blue-700 border-blue-300 ring-1 ring-blue-300" :
                        isCurrent ? "bg-amber-100 text-amber-700 border-amber-200" :
                        "bg-muted/60 text-muted-foreground"
                      )}
                    >
                      {SECTOR_LABELS[sector]?.substring(0, 10) || sector}
                    </Badge>
                  </Link>
                  {i < po.production_sequence.length - 1 && (
                    <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/40 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Current sector indicator */}
        {currentSectorLabel && po.status === "em_producao" && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg px-2.5 py-1.5 border border-blue-100">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Em: <Link to={`/setor/${po.current_sector}`} className="font-semibold hover:underline">{currentSectorLabel}</Link>
            {po.sector_status === "em_producao" && <span className="text-blue-400">· produzindo</span>}
            {po.sector_status === "aguardando" && <span className="text-blue-400">· aguardando</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Production() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [weekFilter, setWeekFilter] = useState("all");
  const queryClient = useQueryClient();
  const now = new Date();

  const { data: productionOrders = [], isLoading } = useQuery({
    queryKey: ["production-orders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 500),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductionOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["production-orders"] }),
  });

  const startProduction = (po) =>
    updateMutation.mutate({ id: po.id, data: { status: "em_producao", started_at: new Date().toISOString() } });

  const pauseProduction = (po) =>
    updateMutation.mutate({ id: po.id, data: { status: "pausado" } });

  const weeks = [];
  for (let i = -2; i <= 6; i++) {
    const weekStart = startOfWeek(addWeeks(now, i), { weekStartsOn: 1 });
    weeks.push({
      label: format(weekStart, "'Semana' dd/MM", { locale: ptBR }),
      value: format(weekStart, "yyyy-'W'ww"),
    });
  }

  const filtered = productionOrders.filter(po => {
    const matchSearch = !search ||
      po.unique_number?.toLowerCase().includes(search.toLowerCase()) ||
      po.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      po.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      po.reference?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || po.status === statusFilter;
    const matchWeek = weekFilter === "all" || po.planned_week === weekFilter;
    return matchSearch && matchStatus && matchWeek;
  });

  const counts = {
    all: productionOrders.length,
    planejamento: productionOrders.filter(p => p.status === "planejamento").length,
    em_producao: productionOrders.filter(p => p.status === "em_producao").length,
    pausado: productionOrders.filter(p => p.status === "pausado").length,
    finalizado: productionOrders.filter(p => p.status === "finalizado").length,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Produção</h1>
        <p className="text-sm text-muted-foreground">Planejamento e controle de ordens de produção</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
              statusFilter === tab.value
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {tab.label}
            <span className={cn("ml-1.5 text-[10px] opacity-70")}>{counts[tab.value]}</span>
          </button>
        ))}
      </div>

      {/* Search + week filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar OP, produto, pedido..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={weekFilter} onValueChange={setWeekFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Semana" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Semanas</SelectItem>
            {weeks.map(w => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center p-8 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground">
            Nenhuma ordem de produção encontrada
          </div>
        ) : (
          filtered.map(po => (
            <POCard key={po.id} po={po} now={now} onStart={startProduction} onPause={pauseProduction} />
          ))
        )}
      </div>
    </div>
  );
}