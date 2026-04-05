import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Calendar, CheckCircle2, MapPin, Truck, ExternalLink, Clock, Send, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import PODetailModal from "@/components/production/PODetailModal";

// Colunas do kanban de agendamento
const COLUMNS = [
  {
    key: "pendente",
    label: "Pendente",
    color: "bg-gray-400",
    textColor: "text-gray-700",
    borderColor: "border-gray-200",
    bg: "bg-gray-50",
    desc: "Aguardando agendamento",
  },
  {
    key: "agendado",
    label: "Agendado",
    color: "bg-blue-500",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    bg: "bg-blue-50",
    desc: "Data de entrega definida",
  },
  {
    key: "em_entrega",
    label: "Em Entrega",
    color: "bg-amber-400",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
    bg: "bg-amber-50",
    desc: "Saiu para entrega",
  },
  {
    key: "entregue",
    label: "Entregue",
    color: "bg-emerald-500",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
    bg: "bg-emerald-50",
    desc: "Entregue ao cliente",
  },
];

function getColumnKey(po) {
  if (po.agendamento_status) return po.agendamento_status;
  if (po.scheduled_date) return "agendado";
  return "pendente";
}

function AgendamentoCard({ po, column, onSchedule, onAdvance, onDetail }) {
  const isOverdue = po.delivery_deadline && new Date(po.delivery_deadline) < new Date() && column !== "entregue";

  return (
    <div className={cn(
      "bg-card rounded-xl border border-border/60 p-3.5 hover:shadow-md transition-all",
      isOverdue && "border-red-200"
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
      </div>

      {po.purchase_location && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1.5">
          <MapPin className="w-3 h-3" />
          <span>{po.purchase_location.replace(/_/g, " ")}</span>
        </div>
      )}

      {po.delivery_deadline && (
        <p className={cn("text-[11px] mb-1.5", isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground")}>
          Prazo: {format(new Date(po.delivery_deadline), "dd/MM/yy")}
        </p>
      )}

      {po.scheduled_date && (
        <p className="text-[11px] text-blue-600 flex items-center gap-1 mb-2">
          <Clock className="w-3 h-3" />
          Agendado: {format(new Date(po.scheduled_date), "dd/MM/yy HH:mm", { locale: ptBR })}
        </p>
      )}

      {/* Ações por coluna */}
      {column === "pendente" && (
        <Button size="sm" className="w-full h-7 text-xs gap-1 mt-1" onClick={() => onSchedule(po)}>
          <Calendar className="w-3 h-3" /> Agendar
        </Button>
      )}
      {column === "agendado" && (
        <Button size="sm" className="w-full h-7 text-xs gap-1 mt-1 bg-amber-500 hover:bg-amber-600" onClick={() => onAdvance(po, "em_entrega")}>
          <Truck className="w-3 h-3" /> Saiu para Entrega
        </Button>
      )}
      {column === "em_entrega" && (
        <Button size="sm" className="w-full h-7 text-xs gap-1 mt-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => onAdvance(po, "entregue")}>
          <CheckCircle2 className="w-3 h-3" /> Confirmar Entrega
        </Button>
      )}
      {column === "entregue" && (
        <Badge className="w-full justify-center text-[11px] mt-1 bg-emerald-100 text-emerald-700 border-emerald-200">✓ Entregue</Badge>
      )}
    </div>
  );
}

export default function Agendamento() {
  const [search, setSearch] = useState("");
  const [scheduling, setScheduling] = useState(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleObs, setScheduleObs] = useState("");
  const [detailPO, setDetailPO] = useState(null);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["agendamento-orders"],
    queryFn: () => base44.entities.ProductionOrder.filter({ current_sector: "agendamento" }),
    refetchInterval: 30000,
  });

  // Confirmar agendamento (pendente → agendado) e define data
  const scheduleMutation = useMutation({
    mutationFn: async ({ po, date, obs }) => {
      return base44.entities.ProductionOrder.update(po.id, {
        agendamento_status: "agendado",
        scheduled_date: date ? new Date(date).toISOString() : null,
        observations: obs ? (po.observations ? po.observations + "\n" + obs : obs) : po.observations,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamento-orders"] });
      setScheduling(null);
      setScheduleDate("");
      setScheduleObs("");
    },
  });

  // Avançar coluna: agendado → em_entrega → entregue
  const advanceMutation = useMutation({
    mutationFn: async ({ po, nextStatus }) => {
      const updates = { agendamento_status: nextStatus };
      if (nextStatus === "entregue") {
        updates.status = "finalizado";
        updates.finished_at = new Date().toISOString();
      }
      return base44.entities.ProductionOrder.update(po.id, updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agendamento-orders"] }),
  });

  const filtered = orders.filter(po =>
    !search ||
    po.unique_number?.toLowerCase().includes(search.toLowerCase()) ||
    po.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    po.order_number?.toLowerCase().includes(search.toLowerCase())
  );

  const byColumn = {
    pendente: filtered.filter(p => getColumnKey(p) === "pendente"),
    agendado: filtered.filter(p => getColumnKey(p) === "agendado"),
    em_entrega: filtered.filter(p => getColumnKey(p) === "em_entrega"),
    entregue: filtered.filter(p => getColumnKey(p) === "entregue"),
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Agendamento</h1>
            <p className="text-sm text-muted-foreground">{orders.length} ordens · {byColumn.entregue.length} entregues</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {COLUMNS.map(col => (
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {COLUMNS.map(col => {
            const items = byColumn[col.key] || [];
            return (
              <div key={col.key} className="flex flex-col">
                <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 bg-background py-1 z-10">
                  <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", col.color)} />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm">{col.label}</span>
                    <p className="text-[10px] text-muted-foreground">{col.desc}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </div>
                <div className="space-y-2.5">
                  {items.length === 0 ? (
                    <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Nenhuma OP
                    </div>
                  ) : (
                    items.map(po => (
                      <AgendamentoCard
                        key={po.id}
                        po={po}
                        column={col.key}
                        onSchedule={setScheduling}
                        onAdvance={(po, next) => advanceMutation.mutate({ po, nextStatus: next })}
                        onDetail={setDetailPO}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Agendar Dialog */}
      <Dialog open={!!scheduling} onOpenChange={() => setScheduling(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Agendar Entrega
            </DialogTitle>
          </DialogHeader>
          {scheduling && (
            <div className="space-y-4">
              <div className="bg-muted/60 rounded-xl p-3 text-sm">
                <p className="font-semibold">{scheduling.unique_number} · {scheduling.product_name}</p>
                <p className="text-muted-foreground text-xs">Pedido: {scheduling.order_number} · Qtd: {scheduling.quantity}</p>
                {scheduling.purchase_location && (
                  <p className="text-xs text-primary mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Destino: {scheduling.purchase_location.replace(/_/g, " ")}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs">Data de Entrega / Coleta</Label>
                <Input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Observações</Label>
                <Input
                  placeholder="Contato, instruções de entrega..."
                  value={scheduleObs}
                  onChange={e => setScheduleObs(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setScheduling(null)}>Cancelar</Button>
                <Button
                  onClick={() => scheduleMutation.mutate({ po: scheduling, date: scheduleDate, obs: scheduleObs })}
                  disabled={scheduleMutation.isPending || !scheduleDate}
                  className="gap-1"
                >
                  <Calendar className="w-4 h-4" />
                  {scheduleMutation.isPending ? "Salvando..." : "Confirmar Agendamento"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PODetailModal po={detailPO} open={!!detailPO} onClose={() => setDetailPO(null)} />
    </div>
  );
}