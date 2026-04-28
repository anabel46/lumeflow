import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Truck, Package, CheckCircle2, Send, Clock, MapPin, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import PODetailModal from "@/components/production/PODetailModal";

const EXPEDICAO_COLUMNS = [
  { key: "aguardando_coleta", label: "Aguardando Coleta", color: "bg-amber-400", textColor: "text-amber-700", borderColor: "border-amber-200", bg: "bg-amber-50" },
  { key: "enviado", label: "Enviado", color: "bg-blue-500", textColor: "text-blue-700", borderColor: "border-blue-200", bg: "bg-blue-50" },
  { key: "entregue", label: "Entregue", color: "bg-emerald-500", textColor: "text-emerald-700", borderColor: "border-emerald-200", bg: "bg-emerald-50" },
];

function ExpedicaoCard({ po, onAdvance, onDetail }) {
  const isOverdue = po.delivery_deadline && new Date(po.delivery_deadline) < new Date();

  return (
    <div className={cn(
      "bg-card rounded-xl border border-border/60 p-3.5 hover:shadow-md transition-all",
      isOverdue && po.expedicao_status !== "entregue" && "border-red-200"
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded font-bold">{po.unique_number}</span>
          <p className="font-semibold text-sm mt-1 leading-tight">{po.product_name}</p>
          {po.reference && <p className="text-[10px] text-muted-foreground font-mono">{po.reference}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => onDetail(po)} className="h-7 w-7 p-0 shrink-0">
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground mb-2">
        <Link to={`/pedidos/${po.order_id}`} className="hover:text-primary font-medium">
          Ped. #{po.order_number}
        </Link>
        <span>Qtd: <strong className="text-foreground">{po.quantity}</strong></span>
        {po.color && <span>Cor: {po.color}</span>}
        {po.purchase_location && (
          <span className="flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5" />
            {po.purchase_location.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {po.delivery_deadline && (
        <p className={cn("text-[11px] mb-2", isOverdue && po.expedicao_status !== "entregue" ? "text-red-500 font-semibold" : "text-muted-foreground")}>
          Prazo: {format(new Date(po.delivery_deadline), "dd/MM/yy")}
        </p>
      )}

      {po.scheduled_date && (
        <p className="text-[11px] text-blue-600 flex items-center gap-1 mb-2">
          <Clock className="w-3 h-3" />
          Agendado: {format(new Date(po.scheduled_date), "dd/MM/yy HH:mm", { locale: ptBR })}
        </p>
      )}

      {onAdvance && (
        <Button 
          size="sm" 
          onClick={() => onAdvance(po)} 
          className="w-full h-7 text-xs gap-1 mt-1 pointer-events-auto"
          type="button"
        >
          {po.expedicao_status === "enviado" 
            ? <><CheckCircle2 className="w-3 h-3" /> Marcar como Entregue</>
            : <><Send className="w-3 h-3" /> Marcar como Enviado</>
          }
        </Button>
      )}
    </div>
  );
}

export default function Expedicao() {
  const [search, setSearch] = useState("");
  const [detailPO, setDetailPO] = useState(null);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["expedicao-orders"],
    queryFn: async () => {
      const [direct, all] = await Promise.all([
        base44.entities.ProductionOrder.filter({ current_sector: "expedicao" }),
        base44.entities.ProductionOrder.list("-created_date", 500)
      ]);
      const isSeparacaoOnly = (seq) => {
        if (!seq || seq.length !== 1) return false;
        const val = seq[0]?.toLowerCase().trim();
        return val === "separacao" || val === "separação";
      };
      const separacaoOnly = all.filter(po => 
        isSeparacaoOnly(po.production_sequence) && 
        po.status !== "finalizado"
      );
      const combined = [...direct];
      separacaoOnly.forEach(po => {
        if (!combined.some(d => d.id === po.id)) {
          combined.push(po);
        }
      });
      return combined;
    },
    refetchInterval: 5000,
  });

  const { data: allProductionOrders = [] } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 500),
    refetchInterval: 10000,
  });

  const advanceMutation = useMutation({
    mutationFn: async (po) => {
      const currentStatus = po.expedicao_status || "aguardando_coleta";
      const updates = {};
      if (currentStatus === "aguardando_coleta") {
        updates.expedicao_status = "enviado";
      } else if (currentStatus === "enviado") {
        updates.expedicao_status = "entregue";
        updates.status = "finalizado";
        updates.finished_at = new Date().toISOString();
      }
      return base44.entities.ProductionOrder.update(po.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expedicao-orders"] });
      queryClient.invalidateQueries({ queryKey: ["sector-orders", "expedicao"] });
      queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
    },
  });

  const handleAdvance = (po) => {
    advanceMutation.mutate(po);
  };

  const filtered = orders.filter(po =>
    !search ||
    po.unique_number?.toLowerCase().includes(search.toLowerCase()) ||
    po.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    po.order_number?.toLowerCase().includes(search.toLowerCase())
  );

  const aguardando = filtered.filter(p => p.expedicao_status === "aguardando_coleta" || !p.expedicao_status);
  const enviado = filtered.filter(p => p.expedicao_status === "enviado");
  const entregue = filtered.filter(p => p.expedicao_status === "entregue");

  const byColumn = { aguardando_coleta: aguardando, enviado, entregue };

  const total = orders.length;
  const totalEntregues = orders.filter(p => p.expedicao_status === "entregue").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Expedição</h1>
            <p className="text-sm text-muted-foreground">{total} ordens · {totalEntregues} entregues</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {EXPEDICAO_COLUMNS.map(col => (
            <Badge key={col.key} variant="outline" className={cn("gap-1.5", col.bg, col.borderColor, col.textColor)}>
              <div className={cn("w-1.5 h-1.5 rounded-full", col.color)} />
              {byColumn[col.key]?.length || 0} {col.label.toLowerCase()}
            </Badge>
          ))}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar OP, produto, pedido..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-center p-8 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {EXPEDICAO_COLUMNS.map(col => {
            const items = byColumn[col.key] || [];
            return (
              <div key={col.key} className="flex flex-col">
                <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 bg-background py-1 z-10">
                  <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", col.color)} />
                  <span className="font-semibold text-sm">{col.label}</span>
                  <Badge variant="secondary" className="text-xs ml-auto">{items.length}</Badge>
                </div>
                <div className="space-y-2.5">
                  {items.length === 0 ? (
                    <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Nenhuma OP
                    </div>
                  ) : (
                    items.map(po => (
                       <ExpedicaoCard
                         key={po.id}
                         po={po}
                         onDetail={setDetailPO}
                         onAdvance={col.key !== "entregue" ? handleAdvance : null}
                       />
                     ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PODetailModal po={detailPO} open={!!detailPO} onClose={() => setDetailPO(null)} />
    </div>
  );
}