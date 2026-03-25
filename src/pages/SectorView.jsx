import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, CheckCircle2, FileText, AlertTriangle, Play, Clock, Star, ArrowRight, Package, Eye, Store, MapPin } from "lucide-react";
import PODetailModal from "@/components/production/PODetailModal";
import StockDeductionAlert from "@/components/production/StockDeductionAlert";
import { format, formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SECTOR_LABELS } from "@/lib/constants";

const SECTOR_STATUS_COLORS = {
  aguardando: "border-l-amber-400 bg-amber-50/30",
  em_producao: "border-l-blue-500 bg-blue-50/30",
  concluido: "border-l-emerald-500 bg-emerald-50/20 opacity-80",
};

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)}>
          <Star
            className={cn("w-5 h-5 transition-colors", star <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
          />
        </button>
      ))}
    </div>
  );
}

function OrderCard({ po, sectorId, onStart, onComplete, onDetail }) {
  const isOverdue = po.delivery_deadline && new Date(po.delivery_deadline) < new Date();
  const sectorStatus = po.sector_status || "aguardando";

  return (
    <div className={cn(
      "bg-card rounded-xl border border-l-4 p-4 hover:shadow-md transition-all",
      isOverdue && sectorStatus !== "concluido" ? "border-l-red-500 bg-red-50/20" : SECTOR_STATUS_COLORS[sectorStatus]
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">{po.unique_number}</span>
            {po.is_intermediate && <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">Intermediário</Badge>}
            {isOverdue && sectorStatus !== "concluido" && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
          </div>

          {/* Product name */}
          <p className="font-semibold mt-1.5 text-sm leading-tight">{po.product_name}</p>
          {po.reference && <p className="text-[11px] text-muted-foreground font-mono">{po.reference}</p>}

          {/* Key info grid */}
          <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              <span>Pedido: <strong className="text-foreground">{po.order_number}</strong></span>
              <span>Qtd: <strong className="text-foreground">{po.quantity}</strong></span>
              {po.color && <span>Cor: <strong className="text-foreground">{po.color}</strong></span>}
            </div>
            {po.complement && (
              <p>Complemento: <strong className="text-foreground">{po.complement}</strong></p>
            )}
            {po.control && (
              <p>Controle: <strong className="text-foreground">{po.control}</strong></p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
              {po.cost_center && (
                <span className="flex items-center gap-1">
                  <Store className="w-3 h-3" />{po.cost_center}
                </span>
              )}
              {po.environment && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{po.environment}
                </span>
              )}
              {po.delivery_deadline && (
                <span className={cn(isOverdue ? "text-red-500 font-semibold" : "")}>
                  Prazo: {format(new Date(po.delivery_deadline), "dd/MM/yy")}
                </span>
              )}
            </div>
          </div>

          {po.sector_started_at && sectorStatus === "em_producao" && (
            <div className="flex items-center gap-1 mt-2 text-xs text-blue-600">
              <Clock className="w-3 h-3" />
              <span>Iniciado: {format(new Date(po.sector_started_at), "HH:mm")} ({formatDistanceStrict(new Date(po.sector_started_at), new Date(), { locale: ptBR })})</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onDetail(po)} className="gap-1 text-xs w-full justify-start">
            <Eye className="w-3 h-3" /> Detalhes
          </Button>
          {po.technical_drawing_url && (
            <a href={po.technical_drawing_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1 text-xs w-full"><FileText className="w-3 h-3" />PDF</Button>
            </a>
          )}
          {sectorStatus === "aguardando" && (
            <Button size="sm" variant="outline" onClick={() => onStart(po)} className="gap-1 text-xs whitespace-nowrap">
              <Play className="w-3 h-3" /> Iniciar
            </Button>
          )}
          {sectorStatus === "em_producao" && (
            <Button size="sm" onClick={() => onComplete(po)} className="gap-1 text-xs whitespace-nowrap">
              <CheckCircle2 className="w-3 h-3" /> Concluir
            </Button>
          )}
          {sectorStatus === "concluido" && (
            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Concluído</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ title, color, count, children }) {
  return (
    <div className="flex-1 min-w-0">
      <div className={cn("flex items-center gap-2 mb-3 px-1")}>
        <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
        <span className="font-semibold text-sm">{title}</span>
        <Badge variant="secondary" className="text-xs ml-1">{count}</Badge>
      </div>
      <div className="space-y-3 min-h-24">
        {children}
      </div>
    </div>
  );
}

export default function SectorView() {
  const { sectorId } = useParams();
  const [search, setSearch] = useState("");
  const [completing, setCompleting] = useState(null);
  const [completionForm, setCompletionForm] = useState({ observations: "", rating: 0, operator: "" });
  const [detailPO, setDetailPO] = useState(null);
  const [stockAlert, setStockAlert] = useState(null); // { po, deductions }
  const [startingPO, setStartingPO] = useState(null); // po pending confirmation
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

  // Check stock and show alert before starting
  const handleStartClick = async (po) => {
    // Only deduce stock on the first sector (step 0)
    if ((po.current_step_index || 0) > 0 || stockItems.length === 0) {
      startMutation.mutate(po);
      return;
    }

    // Try to find bill-of-materials from product components
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
    }).filter(d => d.stockItemId); // only show items that exist in stock

    if (deductions.length === 0) {
      startMutation.mutate(po);
      return;
    }

    setStartingPO(po);
    setStockAlert({ po, deductions });
  };

  const confirmStart = async () => {
    if (!startingPO || !stockAlert) return;
    // Deduct stock items
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sector-orders", sectorId] }),
  });

  const completeMutation = useMutation({
    mutationFn: async ({ po, observations, rating, operator }) => {
      const finishedAt = new Date().toISOString();

      await base44.entities.SectorLog.create({
        production_order_id: po.id,
        unique_number: po.unique_number,
        sector: sectorId,
        action: "saida",
        observations,
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
      queryClient.invalidateQueries({ queryKey: ["sector-orders", sectorId] });
      setCompleting(null);
      setCompletionForm({ observations: "", rating: 0, operator: "" });
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
  const done = filterOrders(productionOrders.filter(po => po.sector_status === "concluido"));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <ArrowRight className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{sectorLabel}</h1>
            <p className="text-sm text-muted-foreground">
              {productionOrders.length} {productionOrders.length === 1 ? "ordem" : "ordens"} neste setor
            </p>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1.5 bg-amber-50 border-amber-200 text-amber-800">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {waiting.length} aguardando
          </Badge>
          <Badge variant="outline" className="gap-1.5 bg-blue-50 border-blue-200 text-blue-800">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            {inProgress.length} em produção
          </Badge>
          <Badge variant="outline" className="gap-1.5 bg-emerald-50 border-emerald-200 text-emerald-800">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {done.length} concluídos
          </Badge>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por OP, produto, referência..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-center p-8 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Aguardando */}
          <KanbanColumn title="Aguardando" color="bg-amber-400" count={waiting.length}>
            {waiting.length === 0 ? (
              <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma ordem aguardando</div>
            ) : (
              waiting.map(po => (
                <OrderCard key={po.id} po={po} sectorId={sectorId}
                  onStart={handleStartClick}
                  onComplete={setCompleting}
                  onDetail={setDetailPO}
                />
              ))
            )}
          </KanbanColumn>

          {/* Em Produção */}
          <KanbanColumn title="Em Produção" color="bg-blue-500" count={inProgress.length}>
            {inProgress.length === 0 ? (
              <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma em produção</div>
            ) : (
              inProgress.map(po => (
                <OrderCard key={po.id} po={po} sectorId={sectorId}
                  onStart={handleStartClick}
                  onComplete={setCompleting}
                  onDetail={setDetailPO}
                />
              ))
            )}
          </KanbanColumn>

          {/* Concluído */}
          <KanbanColumn title="Concluído" color="bg-emerald-500" count={done.length}>
            {done.length === 0 ? (
              <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma concluída</div>
            ) : (
              done.map(po => (
                <OrderCard key={po.id} po={po} sectorId={sectorId}
                  onStart={handleStartClick}
                  onComplete={setCompleting}
                  onDetail={setDetailPO}
                />
              ))
            )}
          </KanbanColumn>
        </div>
      )}

      {/* Detail Modal */}
      <PODetailModal po={detailPO} open={!!detailPO} onClose={() => setDetailPO(null)} />

      {/* Stock Deduction Alert */}
      <StockDeductionAlert
        open={!!stockAlert}
        onClose={() => { setStockAlert(null); setStartingPO(null); }}
        onConfirm={confirmStart}
        deductions={stockAlert?.deductions}
        loading={startMutation.isPending}
      />

      {/* Complete Dialog */}
      <Dialog open={!!completing} onOpenChange={() => setCompleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Concluir Etapa — {sectorLabel}</DialogTitle>
          </DialogHeader>
          {completing && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p className="font-semibold">{completing.unique_number} — {completing.product_name}</p>
                <p className="text-muted-foreground mt-0.5">Pedido: {completing.order_number} | Qtd: {completing.quantity}</p>
                {completing.sector_started_at && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Início: {format(new Date(completing.sector_started_at), "HH:mm 'de' dd/MM")}
                    {" · "}
                    Duração: {formatDistanceStrict(new Date(completing.sector_started_at), new Date(), { locale: ptBR })}
                  </p>
                )}
              </div>

              <div>
                <Label>Operador</Label>
                <Input
                  placeholder="Nome do operador..."
                  value={completionForm.operator}
                  onChange={(e) => setCompletionForm(p => ({ ...p, operator: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Avaliação da qualidade</Label>
                <div className="mt-2">
                  <StarRating
                    value={completionForm.rating}
                    onChange={(v) => setCompletionForm(p => ({ ...p, rating: v }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {["", "Ruim", "Regular", "Bom", "Muito Bom", "Excelente"][completionForm.rating] || "Selecione a avaliação"}
                  </p>
                </div>
              </div>

              <div>
                <Label>Observações / Comentários</Label>
                <Textarea
                  value={completionForm.observations}
                  onChange={(e) => setCompletionForm(p => ({ ...p, observations: e.target.value }))}
                  placeholder="Descreva o que foi feito, problemas encontrados, ajustes realizados..."
                  rows={4}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCompleting(null)}>Cancelar</Button>
                <Button
                  onClick={() => completeMutation.mutate({ po: completing, ...completionForm })}
                  disabled={completeMutation.isPending}
                  className="gap-1"
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