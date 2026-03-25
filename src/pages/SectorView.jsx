import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, CheckCircle2, AlertTriangle, Play, Clock, Star,
  Eye, Store, MapPin, MessageSquare, Package, ArrowRight,
  Wrench, ChevronRight
} from "lucide-react";
import PODetailModal from "@/components/production/PODetailModal";
import StockDeductionAlert from "@/components/production/StockDeductionAlert";
import { format, formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SECTOR_LABELS } from "@/lib/constants";

const SECTOR_STATUS_COLORS = {
  aguardando: "border-l-amber-400",
  em_producao: "border-l-blue-500",
  concluido: "border-l-emerald-500",
};

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)}>
          <Star className={cn("w-5 h-5 transition-colors", star <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
        </button>
      ))}
    </div>
  );
}

function OrderCard({ po, onStart, onComplete, onDetail }) {
  const isOverdue = po.delivery_deadline && new Date(po.delivery_deadline) < new Date() && po.sector_status !== "concluido";
  const sectorStatus = po.sector_status || "aguardando";

  return (
    <div className={cn(
      "bg-card rounded-xl border-l-4 border border-border/60 p-3.5 hover:shadow-md transition-all",
      isOverdue ? "border-l-red-500 bg-red-50/10" : SECTOR_STATUS_COLORS[sectorStatus]
    )}>
      {/* Header: OP + action */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">{po.unique_number}</span>
          {po.is_intermediate && (
            <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700 gap-0.5">
              <Package className="w-2.5 h-2.5" />Inter.
            </Badge>
          )}
          {isOverdue && (
            <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 gap-0.5">
              <AlertTriangle className="w-2.5 h-2.5" />Atrasado
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onDetail(po)} className="h-7 w-7 p-0">
            <Eye className="w-3.5 h-3.5" />
          </Button>
          {sectorStatus === "aguardando" && (
            <Button size="sm" variant="outline" onClick={() => onStart(po)} className="h-7 px-2 gap-1 text-xs">
              <Play className="w-3 h-3" /> Iniciar
            </Button>
          )}
          {sectorStatus === "em_producao" && (
            <Button size="sm" onClick={() => onComplete(po)} className="h-7 px-2 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="w-3 h-3" /> Concluir
            </Button>
          )}
        </div>
      </div>

      {/* Product */}
      <p className="font-semibold text-sm leading-tight">{po.product_name}</p>
      {po.reference && <p className="text-[11px] text-muted-foreground font-mono">{po.reference}</p>}

      {/* Info row */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
        <Link to={`/pedidos/${po.order_id}`} className="hover:text-primary transition-colors">
          Ped. <strong className="text-foreground">#{po.order_number}</strong>
        </Link>
        <span>Qtd: <strong className="text-foreground">{po.quantity}</strong></span>
        {po.color && <span>Cor: <strong className="text-foreground">{po.color}</strong></span>}
        {po.cost_center && <span className="flex items-center gap-0.5"><Store className="w-3 h-3" />{po.cost_center}</span>}
        {po.environment && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{po.environment}</span>}
        {po.delivery_deadline && (
          <span className={cn("flex items-center gap-0.5", isOverdue ? "text-red-500 font-semibold" : "")}>
            {format(new Date(po.delivery_deadline), "dd/MM/yy")}
          </span>
        )}
      </div>

      {/* Observations */}
      {po.observations && (
        <div className="mt-2 flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
          <MessageSquare className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-snug line-clamp-2">{po.observations}</p>
        </div>
      )}

      {/* Timer */}
      {po.sector_started_at && sectorStatus === "em_producao" && (
        <div className="flex items-center gap-1 mt-2 text-xs text-blue-600 font-medium">
          <Clock className="w-3 h-3" />
          {format(new Date(po.sector_started_at), "HH:mm")}
          {" · "}
          {formatDistanceStrict(new Date(po.sector_started_at), new Date(), { locale: ptBR })}
        </div>
      )}

      {/* Sequence mini progress */}
      {po.production_sequence?.length > 0 && (
        <div className="flex items-center gap-0.5 mt-2 overflow-x-auto pb-0.5">
          {po.production_sequence.map((s, i) => {
            const isDone = i < (po.current_step_index ?? 0);
            const isCurrent = s === po.current_sector;
            return (
              <React.Fragment key={i}>
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap",
                  isDone ? "bg-emerald-100 text-emerald-700" :
                  isCurrent ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300" :
                  "bg-muted text-muted-foreground/60"
                )}>
                  {SECTOR_LABELS[s]?.substring(0, 8) || s}
                </span>
                {i < po.production_sequence.length - 1 && (
                  <ChevronRight className="w-2 h-2 text-muted-foreground/30 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GhostCard({ po, onDetail }) {
  return (
    <div className="bg-muted/30 rounded-xl border border-dashed border-muted-foreground/20 p-3 opacity-75">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded font-bold">{po.unique_number}</span>
            {po.is_intermediate && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground/30">Inter.</Badge>
            )}
          </div>
          <p className="text-sm font-medium text-muted-foreground mt-1 leading-tight">{po.product_name}</p>
          <div className="flex gap-3 text-[11px] text-muted-foreground/70 mt-0.5">
            <span>Ped. #{po.order_number}</span>
            <span>Qtd: {po.quantity}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">✓ Concluído</Badge>
          <Button variant="ghost" size="sm" onClick={() => onDetail(po)} className="h-6 px-1.5 text-[11px] text-muted-foreground">
            <Eye className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ title, colorClass, count, children }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 bg-background py-1 z-10">
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", colorClass)} />
        <span className="font-semibold text-sm">{title}</span>
        <Badge variant="secondary" className="text-xs ml-auto">{count}</Badge>
      </div>
      <div className="space-y-2.5">
        {children}
      </div>
    </div>
  );
}

export default function SectorView() {
  const { sectorId } = useParams();
  const [search, setSearch] = useState("");
  const [completing, setCompleting] = useState(null);
  const [completionForm, setCompletionForm] = useState({ observations: "", changes: "", rating: 0, operator: "" });
  const [detailPO, setDetailPO] = useState(null);
  const [stockAlert, setStockAlert] = useState(null);
  const [startingPO, setStartingPO] = useState(null);
  const queryClient = useQueryClient();

  const { data: stockItems = [] } = useQuery({
    queryKey: ["stock-items"],
    queryFn: () => base44.entities.StockItem.list("name", 500),
  });

  const sectorLabel = SECTOR_LABELS[sectorId] || sectorId;

  const { data: productionOrders = [], isLoading } = useQuery({
    queryKey: ["sector-orders", sectorId],
    queryFn: () => base44.entities.ProductionOrder.filter({ current_sector: sectorId }),
    refetchInterval: 30000,
  });

  const { data: allRelevantOrders = [] } = useQuery({
    queryKey: ["sector-passed-orders", sectorId],
    queryFn: async () => {
      const logs = await base44.entities.SectorLog.filter({ sector: sectorId, action: "saida" });
      if (!logs.length) return [];
      const poIds = [...new Set(logs.map(l => l.production_order_id))];
      const results = await Promise.all(
        poIds.map(id => base44.entities.ProductionOrder.filter({ id }).then(r => r?.[0]).catch(() => null))
      );
      return results.filter(Boolean).filter(po => po.current_sector !== sectorId);
    },
    refetchInterval: 30000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["sector-orders", sectorId] });
    queryClient.invalidateQueries({ queryKey: ["sector-passed-orders", sectorId] });
    queryClient.invalidateQueries({ queryKey: ["production-orders"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    queryClient.invalidateQueries({ queryKey: ["sector-chart"] });
  };

  const handleStartClick = async (po) => {
    if ((po.current_step_index || 0) > 0 || stockItems.length === 0) {
      startMutation.mutate(po);
      return;
    }
    const product = await base44.entities.Product.filter({ id: po.product_id }).then(r => r?.[0]).catch(() => null);
    const components = product?.components || [];
    if (components.length === 0) {
      startMutation.mutate(po);
      return;
    }
    const deductions = components.map(comp => {
      const stockItem = stockItems.find(s => s.code === comp.reference || s.name?.toLowerCase() === comp.name?.toLowerCase());
      const needed = (comp.quantity_per_unit || 1) * (po.quantity || 1);
      const currentStock = stockItem ? (stockItem.quantity_factory || 0) : 0;
      const afterStock = currentStock - needed;
      return {
        name: comp.name,
        code: comp.reference || "-",
        unit: stockItem?.unit || "un",
        needed,
        currentStock,
        stockItemId: stockItem?.id || null,
        insufficient: currentStock < needed,
        willBeLow: stockItem && afterStock < (stockItem.minimum_stock || 0) && afterStock >= 0,
      };
    }).filter(d => d.stockItemId);

    if (deductions.length === 0) {
      startMutation.mutate(po);
      return;
    }
    setStartingPO(po);
    setStockAlert({ po, deductions });
  };

  const confirmStart = async () => {
    if (!startingPO || !stockAlert) return;
    for (const d of stockAlert.deductions) {
      if (!d.stockItemId) continue;
      const item = stockItems.find(s => s.id === d.stockItemId);
      if (!item) continue;
      const newQty = Math.max(0, (item.quantity_factory || 0) - d.needed);
      await base44.entities.StockItem.update(d.stockItemId, { quantity_factory: newQty });
      await base44.entities.StockMovement.create({
        stock_item_id: d.stockItemId,
        item_name: d.name,
        item_code: d.code,
        movement_type: "saida",
        quantity: d.needed,
        from_stock: "fabril",
        reason: `Produção iniciada — OP ${startingPO.unique_number}`,
        production_order_id: startingPO.id,
        unique_number: startingPO.unique_number,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    setStockAlert(null);
    startMutation.mutate(startingPO);
    setStartingPO(null);
  };

  const startMutation = useMutation({
    mutationFn: async (po) => {
      await base44.entities.SectorLog.create({
        production_order_id: po.id,
        unique_number: po.unique_number,
        sector: sectorId,
        action: "entrada",
        started_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      });
      return base44.entities.ProductionOrder.update(po.id, {
        sector_status: "em_producao",
        sector_started_at: new Date().toISOString(),
        status: "em_producao",
        started_at: po.started_at || new Date().toISOString(),
      });
    },
    onSuccess: invalidateAll,
  });

  const completeMutation = useMutation({
    mutationFn: async ({ po, observations, changes, rating, operator }) => {
      const finishedAt = new Date().toISOString();
      // Merge observations + changes into log
      const fullObs = [observations, changes ? `Alterações: ${changes}` : ""].filter(Boolean).join("\n\n");
      await base44.entities.SectorLog.create({
        production_order_id: po.id,
        unique_number: po.unique_number,
        sector: sectorId,
        action: "saida",
        observations: fullObs,
        rating,
        operator,
        started_at: po.sector_started_at || null,
        finished_at: finishedAt,
        timestamp: finishedAt,
      });
      const nextIndex = (po.current_step_index || 0) + 1;
      const sequence = po.production_sequence || [];
      if (nextIndex >= sequence.length) {
        return base44.entities.ProductionOrder.update(po.id, {
          current_step_index: nextIndex,
          current_sector: "",
          sector_status: "concluido",
          status: "finalizado",
          finished_at: finishedAt,
        });
      } else {
        return base44.entities.ProductionOrder.update(po.id, {
          current_step_index: nextIndex,
          current_sector: sequence[nextIndex],
          sector_status: "aguardando",
          sector_started_at: null,
        });
      }
    },
    onSuccess: () => {
      invalidateAll();
      setCompleting(null);
      setCompletionForm({ observations: "", changes: "", rating: 0, operator: "" });
    },
  });

  const filterOrders = (orders) =>
    orders.filter(po =>
      !search ||
      po.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      po.unique_number?.toLowerCase().includes(search.toLowerCase()) ||
      po.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      po.reference?.toLowerCase().includes(search.toLowerCase())
    );

  const waiting = filterOrders(productionOrders.filter(po => !po.sector_status || po.sector_status === "aguardando"));
  const inProgress = filterOrders(productionOrders.filter(po => po.sector_status === "em_producao"));
  const doneHere = filterOrders(productionOrders.filter(po => po.sector_status === "concluido"));
  const passed = filterOrders(allRelevantOrders);
  const doneAll = [...doneHere, ...passed.filter(p => !doneHere.some(d => d.id === p.id))];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <ArrowRight className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{sectorLabel}</h1>
            <p className="text-sm text-muted-foreground">{productionOrders.length} {productionOrders.length === 1 ? "ordem" : "ordens"} neste setor</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1.5 bg-amber-50 border-amber-200 text-amber-700">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />{waiting.length} aguardando
          </Badge>
          <Badge variant="outline" className="gap-1.5 bg-blue-50 border-blue-200 text-blue-700">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />{inProgress.length} em produção
          </Badge>
          <Badge variant="outline" className="gap-1.5 bg-emerald-50 border-emerald-200 text-emerald-700">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{doneAll.length} concluídos
          </Badge>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar OP, produto, referência..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-center p-8 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <KanbanColumn title="Aguardando" colorClass="bg-amber-400" count={waiting.length}>
            {waiting.length === 0
              ? <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma aguardando</div>
              : waiting.map(po => (
                  <OrderCard key={po.id} po={po} onStart={handleStartClick} onComplete={setCompleting} onDetail={setDetailPO} />
                ))
            }
          </KanbanColumn>

          <KanbanColumn title="Em Produção" colorClass="bg-blue-500" count={inProgress.length}>
            {inProgress.length === 0
              ? <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma em produção</div>
              : inProgress.map(po => (
                  <OrderCard key={po.id} po={po} onStart={handleStartClick} onComplete={setCompleting} onDetail={setDetailPO} />
                ))
            }
          </KanbanColumn>

          <KanbanColumn title="Concluído" colorClass="bg-emerald-500" count={doneAll.length}>
            {doneAll.length === 0
              ? <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma concluída</div>
              : doneAll.map(po => (
                  <GhostCard key={po.id} po={po} onDetail={setDetailPO} />
                ))
            }
          </KanbanColumn>
        </div>
      )}

      {/* Modals */}
      <PODetailModal po={detailPO} open={!!detailPO} onClose={() => setDetailPO(null)} />

      <StockDeductionAlert
        open={!!stockAlert}
        onClose={() => { setStockAlert(null); setStartingPO(null); }}
        onConfirm={confirmStart}
        deductions={stockAlert?.deductions}
        loading={startMutation.isPending}
      />

      {/* Complete Dialog */}
      <Dialog open={!!completing} onOpenChange={() => setCompleting(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Concluir — {sectorLabel}
            </DialogTitle>
          </DialogHeader>
          {completing && (
            <div className="space-y-4">
              {/* OP summary */}
              <div className="bg-muted/60 rounded-xl p-3 text-sm space-y-0.5">
                <p className="font-semibold">{completing.unique_number} · {completing.product_name}</p>
                <p className="text-muted-foreground text-xs">Pedido: {completing.order_number} · Qtd: {completing.quantity}</p>
                {completing.sector_started_at && (
                  <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    Duração: {formatDistanceStrict(new Date(completing.sector_started_at), new Date(), { locale: ptBR })}
                    {" · "}Início: {format(new Date(completing.sector_started_at), "HH:mm 'de' dd/MM")}
                  </p>
                )}
                {/* Next sector preview */}
                {(() => {
                  const nextIdx = (completing.current_step_index || 0) + 1;
                  const seq = completing.production_sequence || [];
                  const next = seq[nextIdx];
                  return next ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      Próximo setor: <strong className="text-foreground flex items-center gap-0.5">
                        <ChevronRight className="w-3 h-3" />{SECTOR_LABELS[next] || next}
                      </strong>
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-600 font-medium mt-1">✓ Último setor — OP será finalizada</p>
                  );
                })()}
              </div>

              {/* Operator */}
              <div>
                <Label className="text-xs">Operador</Label>
                <Input
                  placeholder="Nome do operador..."
                  value={completionForm.operator}
                  onChange={e => setCompletionForm(p => ({ ...p, operator: e.target.value }))}
                  className="mt-1"
                />
              </div>

              {/* Quality rating */}
              <div>
                <Label className="text-xs">Avaliação da qualidade</Label>
                <div className="mt-1.5">
                  <StarRating value={completionForm.rating} onChange={v => setCompletionForm(p => ({ ...p, rating: v }))} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {["", "Ruim", "Regular", "Bom", "Muito Bom", "Excelente"][completionForm.rating] || "Selecione"}
                  </p>
                </div>
              </div>

              {/* Changes in item */}
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Mudanças / Ajustes no Item
                </Label>
                <Textarea
                  value={completionForm.changes}
                  onChange={e => setCompletionForm(p => ({ ...p, changes: e.target.value }))}
                  placeholder="Descreva qualquer alteração feita no item: ajustes de medida, troca de peça, correção de cor, adaptação..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              {/* General observations */}
              <div>
                <Label className="text-xs">Observações gerais</Label>
                <Textarea
                  value={completionForm.observations}
                  onChange={e => setCompletionForm(p => ({ ...p, observations: e.target.value }))}
                  placeholder="O que foi feito, tempo utilizado, problemas encontrados..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setCompleting(null)}>Cancelar</Button>
                <Button
                  onClick={() => completeMutation.mutate({ po: completing, ...completionForm })}
                  disabled={completeMutation.isPending}
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {completeMutation.isPending ? "Salvando..." : "Confirmar Conclusão"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}