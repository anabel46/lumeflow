import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Play, Pause, ChevronRight, AlertTriangle, Clock,
  Package, Store, MapPin, Calendar, ChevronDown, CheckSquare,
  Square, ExternalLink, X, List, Layers
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, SECTOR_LABELS } from "@/lib/constants";
import { Link } from "react-router-dom";
import { useSankhyaData } from "@/hooks/useSankhyaData";
import SankhyaOpBadge from "@/components/sankhya/SankhyaOpBadge";

const STATUS_TABS = [
  { value: "all", label: "Todos" },
  { value: "planejamento", label: "Planejamento" },
  { value: "em_producao", label: "Em Produção" },
  { value: "pausado", label: "Pausado" },
  { value: "finalizado", label: "Finalizado" },
];

function ProgressBar({ sequence = [], currentIndex = 0, status }) {
  const total = sequence.length;
  if (!total) return null;
  const pct = status === "finalizado" ? 100 : Math.round((currentIndex / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", status === "finalizado" ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
    </div>
  );
}

function PORow({ po, selected, onToggle, onStart, onPause, now }) {
  const isOverdue = po.delivery_deadline && new Date(po.delivery_deadline) < now && po.status !== "finalizado";
  const selectable = po.status === "planejamento" || po.status === "em_producao" || po.status === "pausado";

  return (
    <div className={cn(
      "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-all",
      selected ? "bg-primary/5 border-primary/30" : "bg-card border-border/50 hover:border-border",
      isOverdue && "border-red-200 bg-red-50/20",
      po.status === "finalizado" && "opacity-60"
    )}>
      {/* Checkbox */}
      <div className="mt-0.5 shrink-0">
        <Checkbox
          checked={selected}
          onCheckedChange={() => selectable && onToggle(po.id)}
          disabled={!selectable}
          className="w-3.5 h-3.5"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded font-bold">{po.unique_number}</span>
          <span className="text-sm font-semibold truncate">{po.product_name}</span>
          {po.reference && <span className="text-[11px] text-muted-foreground font-mono">{po.reference}</span>}
          {po.is_intermediate && (
            <Badge variant="outline" className="text-[9px] border-purple-300 text-purple-700 py-0 px-1 gap-0.5">
              <Package className="w-2 h-2" />Inter.
            </Badge>
          )}
          {isOverdue && (
            <Badge variant="outline" className="text-[9px] border-red-300 text-red-600 py-0 px-1 gap-0.5">
              <AlertTriangle className="w-2 h-2" />Atrasado
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0 text-[11px] text-muted-foreground">
          <span>Qtd: <strong className="text-foreground">{po.quantity}</strong></span>
          {po.color && <span>Cor: <strong className="text-foreground">{po.color}</strong></span>}
          {po.complement && <span>{po.complement}</span>}
          {po.environment && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{po.environment}</span>}
        </div>

        <ProgressBar sequence={po.production_sequence} currentIndex={po.current_step_index ?? 0} status={po.status} />

        {po.production_sequence?.length > 0 && (
          <div className="flex items-center gap-0.5 overflow-x-auto pb-0.5 no-scrollbar">
            {po.production_sequence.map((sector, i) => {
              const isDone = i < (po.current_step_index ?? 0);
              const isCurrent = i === (po.current_step_index ?? 0) && po.status === "em_producao";
              const isInProgress = isCurrent && po.sector_status === "em_producao";
              return (
                <React.Fragment key={i}>
                  <Link to={`/setor/${sector}`}>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap transition-opacity hover:opacity-80 cursor-pointer",
                      isDone ? "bg-emerald-100 text-emerald-700" :
                      isInProgress ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300" :
                      isCurrent ? "bg-amber-100 text-amber-700" :
                      "bg-muted text-muted-foreground/60"
                    )}>
                      {SECTOR_LABELS[sector]?.substring(0, 10) || sector}
                    </span>
                  </Link>
                  {i < po.production_sequence.length - 1 && (
                    <ChevronRight className="w-2 h-2 text-muted-foreground/30 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {po.current_sector && po.status === "em_producao" && (
          <div className="flex items-center gap-1 text-[11px] text-blue-600">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <Link to={`/setor/${po.current_sector}`} className="font-semibold hover:underline">
              {SECTOR_LABELS[po.current_sector]}
            </Link>
            <span className="text-blue-400">· {po.sector_status === "em_producao" ? "produzindo" : "aguardando"}</span>
          </div>
        )}
      </div>

      {/* Status + actions */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <Badge variant="outline" className={cn("text-[10px] py-0", STATUS_COLORS[po.status])}>
          {STATUS_LABELS[po.status]}
        </Badge>
        {po.status === "planejamento" && (
          <Button size="sm" variant="outline" onClick={() => onStart(po)} className="h-6 px-2 text-[11px] gap-0.5">
            <Play className="w-2.5 h-2.5" /> Iniciar
          </Button>
        )}
        {po.status === "em_producao" && (
          <Button size="sm" variant="outline" onClick={() => onPause(po)} className="h-6 px-2 text-[11px] gap-0.5">
            <Pause className="w-2.5 h-2.5" /> Pausar
          </Button>
        )}
        {po.status === "pausado" && (
          <Button size="sm" variant="outline" onClick={() => onStart(po)} className="h-6 px-2 text-[11px] gap-0.5 text-amber-600 border-amber-300">
            <Play className="w-2.5 h-2.5" /> Retomar
          </Button>
        )}
      </div>
    </div>
  );
}

function OrderGroupCard({ group, selectedIds, onToggle, onStart, onPause, onSelectAll, now, sankhyaOps = [], sankhyaLoading = false }) {
  const [expanded, setExpanded] = useState(true);
  const { order, pos } = group;

  const isOverdue = order.delivery_deadline && new Date(order.delivery_deadline) < now;
  const total = pos.length;
  const done = pos.filter(p => p.status === "finalizado").length;
  const inProd = pos.filter(p => p.status === "em_producao").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const selectableIds = pos.filter(p => p.status === "planejamento" || p.status === "em_producao" || p.status === "pausado").map(p => p.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));
  const someSelected = selectableIds.some(id => selectedIds.has(id));

  return (
    <div className={cn(
      "bg-card rounded-xl border border-border/60 overflow-hidden hover:shadow-sm transition-all",
      isOverdue && done < total && "border-red-200"
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Select all checkbox */}
        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => onSelectAll(selectableIds, allSelected)}
            disabled={selectableIds.length === 0}
            className="w-4 h-4"
          />
        </div>

        {/* Toggle expand */}
        <button className="flex-1 flex items-center gap-3 text-left min-w-0" onClick={() => setExpanded(e => !e)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/pedidos/${order.id}`}
                className="font-bold text-sm hover:text-primary transition-colors flex items-center gap-1"
                onClick={e => e.stopPropagation()}
              >
                Pedido #{order.order_number}
                <ExternalLink className="w-3 h-3 opacity-50" />
              </Link>
              <span className="text-sm font-medium text-foreground truncate">{order.client_name}</span>
              {isOverdue && done < total && (
                <Badge variant="outline" className="text-[9px] border-red-300 text-red-600 py-0 px-1 gap-0.5">
                  <AlertTriangle className="w-2 h-2" />Atrasado
                </Badge>
              )}
              <SankhyaOpBadge ops={sankhyaOps} loading={sankhyaLoading} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0 text-[11px] text-muted-foreground mt-0.5">
              {order.cost_center && <span className="flex items-center gap-0.5"><Store className="w-2.5 h-2.5" />{order.cost_center}</span>}
              {order.environment && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{order.environment}</span>}
              {order.delivery_deadline && (
                <span className={cn("flex items-center gap-0.5", isOverdue && done < total ? "text-red-500 font-semibold" : "")}>
                  <Calendar className="w-2.5 h-2.5" />
                  {format(new Date(order.delivery_deadline), "dd/MM/yy")}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold">{done}/{total} OPs</p>
              {inProd > 0 && <p className="text-[10px] text-blue-600">{inProd} produzindo</p>}
            </div>
            {/* Mini ring */}
            <div className="relative w-8 h-8 shrink-0">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="12" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                <circle cx="16" cy="16" r="12" fill="none"
                  stroke={done === total ? "hsl(142,71%,45%)" : inProd > 0 ? "hsl(221,83%,53%)" : "hsl(38,92%,50%)"}
                  strokeWidth="4"
                  strokeDasharray={`${(pct / 100) * 75.4} 75.4`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">{pct}%</span>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
          </div>
        </button>
      </div>

      {/* Observations */}
      {order.observations && (
        <div className="mx-4 mb-2 px-2.5 py-1.5 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800 line-clamp-2">
          {order.observations}
        </div>
      )}

      {/* PO Rows */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {pos.map(po => (
            <PORow
              key={po.id}
              po={po}
              selected={selectedIds.has(po.id)}
              onToggle={onToggle}
              onStart={onStart}
              onPause={onPause}
              now={now}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Production() {
  const { getOpsByPedido, loading: sankhyaLoading } = useSankhyaData();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("");
  const [parceiroFilter, setParceiroFilter] = useState("");
  const [uniqueFilter, setUniqueFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [viewMode, setViewMode] = useState("cards"); // "cards" | "list"
  const queryClient = useQueryClient();
  const now = new Date();

  const { data: productionOrders = [], isLoading } = useQuery({
    queryKey: ["production-orders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 500),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => base44.entities.Order.list("-created_date", 500),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductionOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["production-orders"] }),
  });

  const startProduction = async (po) => {
    // Block start if parent order is still pending approval
    const parentOrder = orders.find(o => o.id === po.order_id);
    if (parentOrder?.status === "aprovacao_pendente") {
      alert(`O pedido #${po.order_number} ainda está aguardando aprovação do gerente. Não é possível iniciar a produção.`);
      return;
    }
    await updateMutation.mutateAsync({ id: po.id, data: { status: "em_producao", started_at: new Date().toISOString() } });
    // Update parent order status to em_producao
    if (po.order_id && parentOrder && !["em_producao", "finalizado", "cancelado"].includes(parentOrder.status)) {
      await base44.entities.Order.update(po.order_id, { status: "em_producao" });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  };

  const pauseProduction = (po) =>
    updateMutation.mutate({ id: po.id, data: { status: "pausado" } });

  const handleBulkStart = () => {
    const toStart = productionOrders.filter(
      po => selectedIds.has(po.id) && (po.status === "planejamento" || po.status === "pausado")
    );
    toStart.forEach(startProduction);
    setSelectedIds(new Set());
  };

  const handleBulkPause = () => {
    const toPause = productionOrders.filter(
      po => selectedIds.has(po.id) && po.status === "em_producao"
    );
    toPause.forEach(pauseProduction);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = (ids, allSelected) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  // Build order map for quick lookup
  const orderMap = useMemo(() => {
    const m = {};
    orders.forEach(o => { m[o.id] = o; });
    return m;
  }, [orders]);

  // Filter POs
  const filteredPOs = useMemo(() => {
    return productionOrders.filter(po => {
      if (statusFilter !== "all" && po.status !== statusFilter) return false;

      if (search) {
        const s = search.toLowerCase();
        const order = orderMap[po.order_id];
        if (
          !po.unique_number?.toLowerCase().includes(s) &&
          !po.product_name?.toLowerCase().includes(s) &&
          !po.order_number?.toLowerCase().includes(s) &&
          !po.reference?.toLowerCase().includes(s) &&
          !order?.client_name?.toLowerCase().includes(s) &&
          !order?.cost_center?.toLowerCase().includes(s)
        ) return false;
      }

      if (uniqueFilter) {
        const u = uniqueFilter.toLowerCase();
        if (!po.unique_number?.toLowerCase().includes(u)) return false;
      }

      if (empresaFilter) {
        const e = empresaFilter.toLowerCase();
        const order = orderMap[po.order_id];
        if (
          !po.cost_center?.toLowerCase().includes(e) &&
          !order?.cost_center?.toLowerCase().includes(e)
        ) return false;
      }

      if (parceiroFilter) {
        const p = parceiroFilter.toLowerCase();
        const order = orderMap[po.order_id];
        if (!order?.client_name?.toLowerCase().includes(p)) return false;
      }

      if (dateFilter) {
        const order = orderMap[po.order_id];
        const deadline = po.delivery_deadline || order?.delivery_deadline;
        if (!deadline || !deadline.startsWith(dateFilter)) return false;
      }

      return true;
    });
  }, [productionOrders, statusFilter, search, uniqueFilter, empresaFilter, parceiroFilter, dateFilter, orderMap]);

  // Group by order
  const groups = useMemo(() => {
    const map = {};
    filteredPOs.forEach(po => {
      const key = po.order_id || po.order_number;
      if (!map[key]) {
        const order = orderMap[po.order_id] || {
          id: po.order_id,
          order_number: po.order_number,
          client_name: "",
          cost_center: po.cost_center,
          environment: po.environment,
          delivery_deadline: po.delivery_deadline,
          observations: po.observations,
        };
        map[key] = { order, pos: [] };
      }
      map[key].pos.push(po);
    });
    return Object.values(map);
  }, [filteredPOs, orderMap]);

  const counts = {
    all: productionOrders.length,
    planejamento: productionOrders.filter(p => p.status === "planejamento").length,
    em_producao: productionOrders.filter(p => p.status === "em_producao").length,
    pausado: productionOrders.filter(p => p.status === "pausado").length,
    finalizado: productionOrders.filter(p => p.status === "finalizado").length,
  };

  const selectedCanStart = [...selectedIds].some(id => {
    const po = productionOrders.find(p => p.id === id);
    return po && (po.status === "planejamento" || po.status === "pausado");
  });
  const selectedCanPause = [...selectedIds].some(id => {
    const po = productionOrders.find(p => p.id === id);
    return po && po.status === "em_producao";
  });

  const hasFilters = search || uniqueFilter || empresaFilter || parceiroFilter || dateFilter;

  const clearFilters = () => {
    setSearch("");
    setUniqueFilter("");
    setEmpresaFilter("");
    setParceiroFilter("");
    setDateFilter("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Produção</h1>
        <p className="text-sm text-muted-foreground">Planejamento e controle de ordens de produção</p>
      </div>

      {/* Status tabs + view mode toggle */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
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
              <span className="ml-1.5 text-[10px] opacity-70">{counts[tab.value]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-card">
          <button
            onClick={() => setViewMode("cards")}
            className={cn(
              "px-2 py-1.5 rounded text-xs font-medium transition-all gap-1 flex items-center",
              viewMode === "cards"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            Cards
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "px-2 py-1.5 rounded text-xs font-medium transition-all gap-1 flex items-center",
              viewMode === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="w-3.5 h-3.5" />
            Lista
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-xl p-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {/* Search product/order */}
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Produto, pedido, ref..." className="pl-8 h-8 text-xs" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {/* Unique number */}
          <Input
            placeholder="Nº único"
            className="h-8 text-xs w-32"
            value={uniqueFilter}
            onChange={e => setUniqueFilter(e.target.value)}
          />
          {/* Empresa / cost center */}
          <Input
            placeholder="Empresa / loja"
            className="h-8 text-xs w-36"
            value={empresaFilter}
            onChange={e => setEmpresaFilter(e.target.value)}
          />
          {/* Parceiro / cliente */}
          <Input
            placeholder="Parceiro / cliente"
            className="h-8 text-xs w-40"
            value={parceiroFilter}
            onChange={e => setParceiroFilter(e.target.value)}
          />
          {/* Data de movimento (prazo) */}
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <Input
              type="date"
              className="h-8 text-xs w-36"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              title="Filtrar por prazo de entrega"
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs gap-1 text-muted-foreground">
              <X className="w-3.5 h-3.5" /> Limpar
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {groups.length} pedido(s) · {filteredPOs.length} OP(s)
        </p>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 flex-wrap">
          <span className="text-sm font-medium flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-primary" />
            {selectedIds.size} OP(s) selecionada(s)
          </span>
          <div className="flex gap-2 ml-auto flex-wrap">
            {selectedCanStart && (
              <Button size="sm" onClick={handleBulkStart} className="h-7 gap-1 text-xs">
                <Play className="w-3 h-3" /> Iniciar selecionadas
              </Button>
            )}
            {selectedCanPause && (
              <Button size="sm" variant="outline" onClick={handleBulkPause} className="h-7 gap-1 text-xs">
                <Pause className="w-3 h-3" /> Pausar selecionadas
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="h-7 gap-1 text-xs text-muted-foreground">
              <X className="w-3 h-3" /> Limpar seleção
            </Button>
          </div>
        </div>
      )}

      {/* View content */}
      {isLoading ? (
        <div className="text-center p-8 text-muted-foreground">Carregando...</div>
      ) : groups.length === 0 ? (
        <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground">
          Nenhuma ordem encontrada
        </div>
      ) : viewMode === "cards" ? (
        /* Cards view */
        <div className="space-y-3">
          {groups.map(group => (
            <OrderGroupCard
              key={group.order.id || group.order.order_number}
              group={group}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
              onStart={startProduction}
              onPause={pauseProduction}
              onSelectAll={handleSelectAll}
              now={now}
              sankhyaOps={getOpsByPedido(group.order.order_number)}
              sankhyaLoading={sankhyaLoading}
            />
          ))}
        </div>
      ) : (
        /* Spreadsheet view */
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left font-semibold">
                  <Checkbox
                    checked={filteredPOs.length > 0 && filteredPOs.every(po => selectedIds.has(po.id))}
                    onCheckedChange={() => {
                      const selectableIds = filteredPOs.filter(p => p.status === "planejamento" || p.status === "em_producao" || p.status === "pausado").map(p => p.id);
                      handleSelectAll(selectableIds, filteredPOs.every(po => selectedIds.has(po.id)));
                    }}
                    className="w-4 h-4"
                  />
                </th>
                <th className="p-3 text-left font-semibold">Nº Único</th>
                <th className="p-3 text-left font-semibold">Produto</th>
                <th className="p-3 text-left font-semibold">Pedido</th>
                <th className="p-3 text-center font-semibold">Qtd</th>
                <th className="p-3 text-left font-semibold">Parceiro</th>
                <th className="p-3 text-left font-semibold">Empresa</th>
                <th className="p-3 text-left font-semibold">Prazo</th>
                <th className="p-3 text-center font-semibold">Progresso</th>
                <th className="p-3 text-center font-semibold">Status</th>
                <th className="p-3 text-center font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.map((po, idx) => {
                const order = orderMap[po.order_id];
                const isOverdue = po.delivery_deadline && new Date(po.delivery_deadline) < now && po.status !== "finalizado";
                const selectable = po.status === "planejamento" || po.status === "em_producao" || po.status === "pausado";
                return (
                  <tr
                    key={po.id}
                    className={cn(
                      "border-b hover:bg-muted/30 transition-colors",
                      idx % 2 === 0 ? "bg-white/50" : "bg-muted/10",
                      isOverdue && "bg-red-50/30"
                    )}
                  >
                    <td className="p-2">
                      <Checkbox
                        checked={selectedIds.has(po.id)}
                        onCheckedChange={() => selectable && toggleSelect(po.id)}
                        disabled={!selectable}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="p-3 font-mono font-bold text-primary">{po.unique_number}</td>
                    <td className="p-3 font-medium">
                      <div className="truncate">{po.product_name}</div>
                      {po.reference && <div className="text-[10px] text-muted-foreground">{po.reference}</div>}
                    </td>
                    <td className="p-3">
                      <Link to={`/pedidos/${po.order_id}`} className="text-primary hover:underline font-semibold">
                        #{po.order_number}
                      </Link>
                    </td>
                    <td className="p-3 text-center font-medium">{po.quantity}</td>
                    <td className="p-3 truncate">{order?.client_name || "-"}</td>
                    <td className="p-3 truncate">{order?.cost_center || po.cost_center || "-"}</td>
                    <td className="p-3">
                      {po.delivery_deadline ? format(new Date(po.delivery_deadline), "dd/MM/yy") : "-"}
                      {isOverdue && <div className="text-red-600 font-semibold text-[9px]">Atrasado</div>}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", po.status === "finalizado" ? "bg-emerald-500" : "bg-primary")}
                            style={{
                              width: `${po.status === "finalizado" ? 100 : Math.round(((po.current_step_index ?? 0) / (po.production_sequence?.length || 1)) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-[9px] w-8 text-right">{po.status === "finalizado" ? 100 : Math.round(((po.current_step_index ?? 0) / (po.production_sequence?.length || 1)) * 100)}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={cn("text-[9px] py-0", STATUS_COLORS[po.status])}>
                        {STATUS_LABELS[po.status]}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      {po.status === "planejamento" && (
                        <Button size="sm" variant="outline" onClick={() => startProduction(po)} className="h-6 px-1.5 text-[10px]">
                          <Play className="w-3 h-3" />
                        </Button>
                      )}
                      {po.status === "em_producao" && (
                        <Button size="sm" variant="outline" onClick={() => pauseProduction(po)} className="h-6 px-1.5 text-[10px]">
                          <Pause className="w-3 h-3" />
                        </Button>
                      )}
                      {po.status === "pausado" && (
                        <Button size="sm" variant="outline" onClick={() => startProduction(po)} className="h-6 px-1.5 text-[10px] text-amber-600 border-amber-300">
                          <Play className="w-3 h-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}