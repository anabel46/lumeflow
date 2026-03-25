import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, CheckCircle2, FileText, ArrowRight, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SECTOR_LABELS } from "@/lib/constants";

const GROUPABLE_SECTORS = ["estamparia", "tornearia"];

export default function SectorView() {
  const { sectorId } = useParams();
  const [search, setSearch] = useState("");
  const [completing, setCompleting] = useState(null);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const sectorLabel = SECTOR_LABELS[sectorId] || sectorId;
  const isGroupable = GROUPABLE_SECTORS.includes(sectorId);

  const { data: productionOrders = [], isLoading } = useQuery({
    queryKey: ["sector-orders", sectorId],
    queryFn: () => base44.entities.ProductionOrder.filter({ current_sector: sectorId, status: "em_producao" }),
  });

  const completeMutation = useMutation({
    mutationFn: async ({ po, observations }) => {
      // Log the exit from current sector
      await base44.entities.SectorLog.create({
        production_order_id: po.id,
        unique_number: po.unique_number,
        sector: sectorId,
        action: "saida",
        observations,
        timestamp: new Date().toISOString(),
      });

      const nextIndex = (po.current_step_index || 0) + 1;
      const sequence = po.production_sequence || [];

      if (nextIndex >= sequence.length) {
        // Production is complete
        return base44.entities.ProductionOrder.update(po.id, {
          current_step_index: nextIndex,
          current_sector: "",
          status: "finalizado",
          finished_at: new Date().toISOString(),
        });
      } else {
        // Move to next sector
        return base44.entities.ProductionOrder.update(po.id, {
          current_step_index: nextIndex,
          current_sector: sequence[nextIndex],
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sector-orders", sectorId] });
      setCompleting(null);
      setNotes("");
    },
  });

  // Group by reference for estamparia/tornearia, sort by oldest request date
  let displayOrders;
  if (isGroupable) {
    const groups = {};
    productionOrders.forEach(po => {
      const ref = po.reference || "sem-ref";
      if (!groups[ref]) groups[ref] = [];
      groups[ref].push(po);
    });
    // Sort each group by request_date
    Object.values(groups).forEach(group => group.sort((a, b) => new Date(a.request_date || 0) - new Date(b.request_date || 0)));
    displayOrders = Object.entries(groups).sort(([, a], [, b]) => new Date(a[0]?.request_date || 0) - new Date(b[0]?.request_date || 0));
  } else {
    displayOrders = productionOrders.sort((a, b) => (a.order_number || "").localeCompare(b.order_number || ""));
  }

  const filtered = isGroupable
    ? displayOrders.filter(([ref, items]) =>
        ref.toLowerCase().includes(search.toLowerCase()) ||
        items.some(po => po.order_number?.toLowerCase().includes(search.toLowerCase()) || po.product_name?.toLowerCase().includes(search.toLowerCase()))
      )
    : productionOrders.filter(po =>
        po.order_number?.toLowerCase().includes(search.toLowerCase()) ||
        po.unique_number?.toLowerCase().includes(search.toLowerCase()) ||
        po.product_name?.toLowerCase().includes(search.toLowerCase())
      );

  const now = new Date();

  const OrderCard = ({ po }) => {
    const isOverdue = po.delivery_deadline && new Date(po.delivery_deadline) < now;
    return (
      <div className={cn("bg-card rounded-xl border p-4 hover:shadow-md transition-all", isOverdue && "border-red-200 bg-red-50/30")}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">{po.unique_number}</span>
              {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
            </div>
            <p className="font-semibold mt-1.5 text-sm">{po.product_name}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
              <span>Pedido: <strong className="text-foreground">{po.order_number}</strong></span>
              <span>Ref: <strong className="text-foreground">{po.reference}</strong></span>
              <span>Qtd: <strong className="text-foreground">{po.quantity}</strong></span>
              <span>Cor: <strong className="text-foreground">{po.color || "-"}</strong></span>
              <span>C.Custo: <strong className="text-foreground">{po.cost_center || "-"}</strong></span>
              <span>Amb: <strong className="text-foreground">{po.environment || "-"}</strong></span>
              {po.request_date && <span>Solic: <strong className="text-foreground">{format(new Date(po.request_date), "dd/MM/yy")}</strong></span>}
              {po.delivery_deadline && <span>Prazo: <strong className={cn(isOverdue ? "text-red-500" : "text-foreground")}>{format(new Date(po.delivery_deadline), "dd/MM/yy")}</strong></span>}
            </div>
            {po.complement && <p className="text-xs mt-1 text-muted-foreground">Compl: {po.complement}</p>}
            {po.observations && <p className="text-xs mt-1 text-muted-foreground italic">{po.observations}</p>}
          </div>
          <div className="flex flex-col gap-2 ml-3">
            {po.technical_drawing_url && (
              <a href={po.technical_drawing_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1 text-xs"><FileText className="w-3 h-3" /> PDF</Button>
              </a>
            )}
            <Button size="sm" onClick={() => setCompleting(po)} className="gap-1 text-xs">
              <CheckCircle2 className="w-3 h-3" /> Concluir
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <ArrowRight className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{sectorLabel}</h1>
          <p className="text-sm text-muted-foreground">
            {productionOrders.length} {productionOrders.length === 1 ? "ordem" : "ordens"} em andamento
            {isGroupable && " • Agrupado por referência"}
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-center p-8 text-muted-foreground">Carregando...</div>
      ) : isGroupable ? (
        <div className="space-y-6">
          {filtered.length === 0 ? (
            <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground">Nenhuma ordem neste setor</div>
          ) : (
            filtered.map(([ref, items]) => (
              <div key={ref}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-xs font-semibold">Ref: {ref}</Badge>
                  <span className="text-xs text-muted-foreground">{items.length} peças</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map(po => <OrderCard key={po.id} po={po} />)}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full bg-card rounded-2xl border p-8 text-center text-muted-foreground">Nenhuma ordem neste setor</div>
          ) : (
            filtered.map(po => <OrderCard key={po.id} po={po} />)
          )}
        </div>
      )}

      {/* Complete Dialog */}
      <Dialog open={!!completing} onOpenChange={() => setCompleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir Etapa - {sectorLabel}</DialogTitle>
          </DialogHeader>
          {completing && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p><strong>{completing.unique_number}</strong> - {completing.product_name}</p>
                <p className="text-muted-foreground mt-1">Pedido: {completing.order_number} | Qtd: {completing.quantity}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Observações</p>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações opcionais..." rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCompleting(null)}>Cancelar</Button>
                <Button onClick={() => completeMutation.mutate({ po: completing, observations: notes })} className="gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Confirmar Conclusão
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}