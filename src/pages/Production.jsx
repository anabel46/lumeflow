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

const STATUS_TABS = [
  { value: "all", label: "Todos" },
  { value: "P", label: "Planejamento" },
  { value: "A", label: "Em Produção" },
  { value: "F", label: "Finalizado" },
];



function PORow({ op, selected, onToggle, onStart, onPause, now }) {
  const produto = op.produtos?.[0];
  const ativAtual = op.atividades?.find(a => a.situacao === "Em andamento") || op.atividades?.[0];
  const totalAtiv = op.atividades?.length || 0;
  const finalizadas = op.atividades?.filter(a => a.situacao === "Finalizada").length || 0;
  const pct = totalAtiv > 0 ? Math.round((finalizadas / totalAtiv) * 100) : 0;

  return (
    <div className={cn(
      "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-all",
      selected ? "bg-primary/5 border-primary/30" : "bg-card border-border/50 hover:border-border",
      op.situacaoGeral === "F" && "opacity-60"
    )}>
      {/* Checkbox */}
      <div className="mt-0.5 shrink-0">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(op.numeroOp)}
          disabled={op.situacaoGeral === "F"}
          className="w-3.5 h-3.5"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Header: OP + Descrição + Produto + Referência */}
        <div className="flex items-center flex-wrap gap-2">
          <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded font-bold">OP-{op.numeroOp}</span>
          <span className="text-sm font-semibold text-blue-600">{ativAtual?.descricao || "—"}</span>
          <span className="text-sm font-medium">{produto?.descricao}</span>
          {produto?.referencia && (
            <span className="text-[11px] text-muted-foreground font-mono">{produto.referencia}</span>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", op.situacaoGeral === "F" ? "bg-emerald-500" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
        </div>

        {/* Etapas de produção - Kanban style */}
        {op.atividades && op.atividades.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {Array.from(new Map(op.atividades.map(a => [a.descricao, a])).values()).map((ativ, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className={cn(
                  "text-[10px] py-0.5 px-2 font-medium",
                  ativ.situacao === "Finalizada" 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                    : ativ.situacao === "Em andamento"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                {ativ.descricao}
              </Badge>
            ))}
          </div>
        )}

        {/* Status atual com indicator */}
        {ativAtual && op.situacaoGeral === "A" && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-blue-600 font-semibold">{ativAtual.situacao}</span>
          </div>
        )}
      </div>

      {/* Status + actions */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <Badge variant="outline" className={cn("text-[10px] py-0", 
          op.situacaoGeral === "P" ? "bg-amber-100 text-amber-700 border-amber-200" :
          op.situacaoGeral === "A" ? "bg-blue-100 text-blue-700 border-blue-200" :
          "bg-emerald-100 text-emerald-700 border-emerald-200"
        )}>
          {op.situacaoGeral === "P" ? "Planejamento" : op.situacaoGeral === "A" ? "Em Produção" : "Finalizado"}
        </Badge>
        {op.situacaoGeral === "P" && (
          <Button size="sm" variant="outline" onClick={() => onStart(op)} className="h-6 px-2 text-[11px] gap-0.5">
            <Play className="w-2.5 h-2.5" /> Iniciar
          </Button>
        )}
        {op.situacaoGeral === "A" && (
          <Button size="sm" variant="outline" onClick={() => onPause(op)} className="h-6 px-2 text-[11px] gap-0.5">
            <Pause className="w-2.5 h-2.5" /> Pausar
          </Button>
        )}
      </div>
    </div>
  );
}

function PedidoCard({ numeroPedido, ops, selectedIds, onToggle, onStart, onPause, onSelectAll, now }) {
  const [expanded, setExpanded] = useState(true);
  const opsList = Object.values(ops);
  const total = opsList.length;
  const finalizadas = opsList.filter(o => o.situacaoGeral === "F").length;
  const emAndamento = opsList.filter(o => o.situacaoGeral === "A").length;
  const pct = total > 0 ? Math.round((finalizadas / total) * 100) : 0;

  const selectableIds = opsList.filter(o => o.situacaoGeral !== "F").map(o => o.numeroOp);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));

  return (
    <div className="bg-card rounded-xl border border-border/60 overflow-hidden hover:shadow-sm transition-all">
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
            <span className="font-bold text-sm hover:text-primary transition-colors">
              Pedido #{numeroPedido}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold">{finalizadas}/{total} OPs</p>
              {emAndamento > 0 && <p className="text-[10px] text-blue-600">{emAndamento} produzindo</p>}
            </div>
            <div className="relative w-8 h-8 shrink-0">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="12" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                <circle cx="16" cy="16" r="12" fill="none"
                  stroke={finalizadas === total ? "hsl(142,71%,45%)" : emAndamento > 0 ? "hsl(221,83%,53%)" : "hsl(38,92%,50%)"}
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

      {/* OP Rows */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {opsList.map(op => (
            <PORow
              key={op.numeroOp}
              op={op}
              selected={selectedIds.has(op.numeroOp)}
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [viewMode, setViewMode] = useState("cards");
  const queryClient = useQueryClient();
  const now = new Date();

  // Fetch structured data from getDashboard API
  const { data: apiData = {}, isLoading } = useQuery({
    queryKey: ["dashboard-sankhya"],
    queryFn: async () => {
      const response = await base44.functions.invoke("getDashboard", {});
      return response.data;
    },
  });

  const pedidos = apiData?.pedidos || {};
  const estatisticas = apiData?.estatisticas || {};

  // Flatten OPs for filtering
  const allOps = useMemo(() => {
    const ops = [];
    Object.entries(pedidos).forEach(([numPedido, opsMap]) => {
      Object.values(opsMap).forEach(op => {
        ops.push({ ...op, numeroPedido: parseInt(numPedido) });
      });
    });
    return ops;
  }, [pedidos]);

  // Filter OPs
  const filteredOps = useMemo(() => {
    return allOps.filter(op => {
      if (statusFilter !== "all" && op.situacaoGeral !== statusFilter) return false;
      
      if (search) {
        const s = search.toLowerCase();
        const product = op.produtos?.[0];
        if (
          !op.numeroOp?.toString().includes(s) &&
          !product?.descricao?.toLowerCase().includes(s) &&
          !product?.referencia?.toLowerCase().includes(s) &&
          !op.numeroPedido?.toString().includes(s)
        ) return false;
      }
      
      return true;
    });
  }, [allOps, statusFilter, search]);

  // Group filtered OPs by pedido
  const groupedPedidos = useMemo(() => {
    const grouped = {};
    filteredOps.forEach(op => {
      if (!grouped[op.numeroPedido]) {
        grouped[op.numeroPedido] = {};
      }
      grouped[op.numeroPedido][op.numeroOp] = op;
    });
    return Object.entries(grouped);
  }, [filteredOps]);

  const handleBulkStart = () => {
    const toStart = allOps.filter(op => selectedIds.has(op.numeroOp) && op.situacaoGeral === "P");
    toStart.forEach(op => console.log("Iniciar:", op.numeroOp));
    setSelectedIds(new Set());
  };

  const handleBulkPause = () => {
    const toPause = allOps.filter(op => selectedIds.has(op.numeroOp) && op.situacaoGeral === "A");
    toPause.forEach(op => console.log("Pausar:", op.numeroOp));
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

  const counts = {
    all: estatisticas.totalOps || 0,
    P: estatisticas.aguardando || 0,
    A: estatisticas.emAndamento || 0,
    F: estatisticas.finalizadas || 0,
  };

  const selectedCanStart = [...selectedIds].some(id => {
    const op = allOps.find(o => o.numeroOp === id);
    return op && op.situacaoGeral === "P";
  });

  const selectedCanPause = [...selectedIds].some(id => {
    const op = allOps.find(o => o.numeroOp === id);
    return op && op.situacaoGeral === "A";
  });

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
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Produto, pedido, ref..." className="pl-8 h-8 text-xs" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {search && (
            <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="h-8 px-2 text-xs gap-1 text-muted-foreground">
              <X className="w-3.5 h-3.5" /> Limpar
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {groupedPedidos.length} pedido(s) · {filteredOps.length} OP(s)
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
      ) : groupedPedidos.length === 0 ? (
        <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground">
          Nenhuma ordem encontrada
        </div>
      ) : viewMode === "cards" ? (
        <div className="space-y-3">
          {groupedPedidos.map(([numeroPedido, opsMap]) => (
            <PedidoCard
              key={numeroPedido}
              numeroPedido={numeroPedido}
              ops={opsMap}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
              onStart={(op) => console.log("Iniciar:", op.numeroOp)}
              onPause={(op) => console.log("Pausar:", op.numeroOp)}
              onSelectAll={handleSelectAll}
              now={now}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left font-semibold">
                  <Checkbox
                    checked={filteredOps.length > 0 && filteredOps.every(op => selectedIds.has(op.numeroOp))}
                    onCheckedChange={() => {
                      const selectableIds = filteredOps.filter(o => o.situacaoGeral !== "F").map(o => o.numeroOp);
                      handleSelectAll(selectableIds, filteredOps.every(op => selectedIds.has(op.numeroOp)));
                    }}
                    className="w-4 h-4"
                  />
                </th>
                <th className="p-3 text-left font-semibold">OP</th>
                <th className="p-3 text-left font-semibold">Produto</th>
                <th className="p-3 text-left font-semibold">Pedido</th>
                <th className="p-3 text-center font-semibold">Etapa Atual</th>
                <th className="p-3 text-center font-semibold">Progresso</th>
                <th className="p-3 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOps.map((op, idx) => (
                <tr
                  key={op.numeroOp}
                  className={cn(
                    "border-b hover:bg-muted/30 transition-colors",
                    idx % 2 === 0 ? "bg-white/50" : "bg-muted/10"
                  )}
                >
                  <td className="p-2">
                    <Checkbox
                      checked={selectedIds.has(op.numeroOp)}
                      onCheckedChange={() => toggleSelect(op.numeroOp)}
                      disabled={op.situacaoGeral === "F"}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="p-3 font-mono font-bold text-primary">OP-{op.numeroOp}</td>
                  <td className="p-3 font-medium">
                    <div className="truncate">{op.produtos?.[0]?.descricao}</div>
                    {op.produtos?.[0]?.referencia && <div className="text-[10px] text-muted-foreground">{op.produtos[0].referencia}</div>}
                  </td>
                  <td className="p-3 font-semibold">#{op.numeroPedido}</td>
                  <td className="p-3 text-center text-sm">{op.descricaoAtividade || "—"}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", op.situacaoGeral === "F" ? "bg-emerald-500" : "bg-primary")}
                          style={{
                            width: `${op.situacaoGeral === "F" ? 100 : op.atividades?.length > 0 ? Math.round((op.atividades.filter(a => a.situacao === "Finalizada").length / op.atividades.length) * 100) : 0}%`
                          }}
                        />
                      </div>
                      <span className="text-[9px] w-8 text-right">
                        {op.situacaoGeral === "F" ? 100 : op.atividades?.length > 0 ? Math.round((op.atividades.filter(a => a.situacao === "Finalizada").length / op.atividades.length) * 100) : 0}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant="outline" className={cn("text-[9px] py-0",
                      op.situacaoGeral === "P" ? "bg-amber-100 text-amber-700 border-amber-200" :
                      op.situacaoGeral === "A" ? "bg-blue-100 text-blue-700 border-blue-200" :
                      "bg-emerald-100 text-emerald-700 border-emerald-200"
                    )}>
                      {op.situacaoGeral === "P" ? "Plan." : op.situacaoGeral === "A" ? "Prod." : "Fim."}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}