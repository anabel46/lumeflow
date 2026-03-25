import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Wrench, Clock, CheckCircle2, XCircle, AlertCircle, Package } from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  aberto: { label: "Aberto", color: "bg-blue-100 text-blue-800 border-blue-200", icon: AlertCircle },
  em_reparo: { label: "Em Reparo", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Wrench },
  aguardando_peca: { label: "Aguard. Peça", color: "bg-orange-100 text-orange-800 border-orange-200", icon: Package },
  concluido: { label: "Concluído", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-600 border-gray-200", icon: XCircle },
};

const emptyForm = {
  ticket_number: "",
  order_number: "",
  client_name: "",
  product_name: "",
  reference: "",
  problem_description: "",
  activities: "",
  technician: "",
  repair_sector: "mesa_sac",
  status: "aberto",
  observations: "",
};

export default function Sac() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showStatusDialog, setShowStatusDialog] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["sac-tickets"],
    queryFn: () => base44.entities.SacTicket.list("-created_date", 200),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Auto-generate ticket number
      const ticketData = { ...data };
      if (!ticketData.ticket_number) {
        ticketData.ticket_number = `SAC-${Date.now().toString(36).toUpperCase()}`;
      }
      if (editing) {
        return base44.entities.SacTicket.update(editing.id, ticketData);
      }
      // When opening, create a production order for repair tracking
      const ticket = await base44.entities.SacTicket.create(ticketData);
      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sac-tickets"] });
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, observations, technician, finished_at }) =>
      base44.entities.SacTicket.update(id, {
        status,
        ...(observations ? { observations } : {}),
        ...(technician ? { technician } : {}),
        ...(status === "em_reparo" ? { started_at: new Date().toISOString() } : {}),
        ...(status === "concluido" ? { finished_at: new Date().toISOString() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sac-tickets"] });
      setShowStatusDialog(null);
    },
  });

  const openCreate = () => {
    setForm({ ...emptyForm });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (ticket) => {
    setForm({ ...emptyForm, ...ticket });
    setEditing(ticket);
    setShowForm(true);
  };

  const filtered = tickets.filter(t => {
    const matchSearch = !search ||
      t.ticket_number?.toLowerCase().includes(search.toLowerCase()) ||
      t.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.order_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCount = tickets.filter(t => t.status === "aberto" || t.status === "em_reparo" || t.status === "aguardando_peca").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">SAC — Serviço Pós-Venda</h1>
          <p className="text-sm text-muted-foreground">
            Chamados de reparo e atendimento pós-venda
            {openCount > 0 && <span className="ml-2 text-amber-600 font-medium">· {openCount} em aberto</span>}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo Chamado</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar chamado, cliente, produto..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tickets */}
      {isLoading ? (
        <div className="text-center p-8 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground">Nenhum chamado encontrado</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => {
            const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.aberto;
            const Icon = cfg.icon;
            return (
              <div key={ticket.id} className={cn("bg-card rounded-2xl border p-5 hover:shadow-md transition-all", ticket.status === "concluido" && "opacity-75")}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">{ticket.ticket_number}</span>
                      {ticket.order_number && <span className="text-xs text-muted-foreground">Pedido: {ticket.order_number}</span>}
                      <Badge variant="outline" className={cn("text-xs gap-1", cfg.color)}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </Badge>
                    </div>

                    <div className="mt-2">
                      <p className="font-semibold">{ticket.client_name}</p>
                      <p className="text-sm text-muted-foreground">{ticket.product_name} {ticket.reference && <span>({ticket.reference})</span>}</p>
                    </div>

                    <div className="mt-2 bg-muted/50 rounded-lg p-2.5 text-sm">
                      <p className="font-medium text-xs text-muted-foreground mb-1">PROBLEMA</p>
                      <p>{ticket.problem_description}</p>
                    </div>

                    {ticket.activities && (
                      <div className="mt-2 bg-blue-50 rounded-lg p-2.5 text-sm border border-blue-100">
                        <p className="font-medium text-xs text-blue-600 mb-1">ATIVIDADES</p>
                        <p className="text-blue-900">{ticket.activities}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      {ticket.technician && <span>Técnico: <strong className="text-foreground">{ticket.technician}</strong></span>}
                      {ticket.started_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Início: {format(new Date(ticket.started_at), "dd/MM HH:mm")}</span>}
                      {ticket.finished_at && ticket.started_at && (
                        <span>Duração: {formatDistanceStrict(new Date(ticket.started_at), new Date(ticket.finished_at), { locale: ptBR })}</span>
                      )}
                      <span>Aberto em: {ticket.created_date ? format(new Date(ticket.created_date), "dd/MM/yyyy") : "-"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 min-w-fit">
                    {ticket.status === "aberto" && (
                      <Button size="sm" className="gap-1 whitespace-nowrap" onClick={() => updateStatusMutation.mutate({ id: ticket.id, status: "em_reparo" })}>
                        <Wrench className="w-3.5 h-3.5" /> Iniciar Reparo
                      </Button>
                    )}
                    {ticket.status === "em_reparo" && (
                      <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap" onClick={() => updateStatusMutation.mutate({ id: ticket.id, status: "concluido" })}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                      </Button>
                    )}
                    {ticket.status === "em_reparo" && (
                      <Button size="sm" variant="outline" className="gap-1 whitespace-nowrap" onClick={() => updateStatusMutation.mutate({ id: ticket.id, status: "aguardando_peca" })}>
                        <Package className="w-3.5 h-3.5" /> Aguard. Peça
                      </Button>
                    )}
                    {ticket.status === "aguardando_peca" && (
                      <Button size="sm" variant="outline" className="gap-1 whitespace-nowrap" onClick={() => updateStatusMutation.mutate({ id: ticket.id, status: "em_reparo" })}>
                        <Wrench className="w-3.5 h-3.5" /> Retomar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="gap-1 whitespace-nowrap" onClick={() => openEdit(ticket)}>
                      Editar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={() => { setShowForm(false); setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Chamado SAC" : "Novo Chamado SAC"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº do Pedido Original</Label>
                <Input value={form.order_number} onChange={e => setForm(p => ({ ...p, order_number: e.target.value }))} className="mt-1" placeholder="Ex: 1234" />
              </div>
              <div>
                <Label>Cliente *</Label>
                <Input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} required className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Produto *</Label>
                <Input value={form.product_name} onChange={e => setForm(p => ({ ...p, product_name: e.target.value }))} required className="mt-1" />
              </div>
              <div>
                <Label>Referência</Label>
                <Input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Descrição do Problema *</Label>
              <Textarea
                value={form.problem_description}
                onChange={e => setForm(p => ({ ...p, problem_description: e.target.value }))}
                required rows={3} className="mt-1"
                placeholder="Descreva o defeito ou problema relatado pelo cliente..."
              />
            </div>

            <div>
              <Label>Atividades a Realizar</Label>
              <Textarea
                value={form.activities}
                onChange={e => setForm(p => ({ ...p, activities: e.target.value }))}
                rows={3} className="mt-1"
                placeholder="Liste as atividades e reparos que serão executados..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Técnico Responsável</Label>
                <Input value={form.technician} onChange={e => setForm(p => ({ ...p, technician: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} rows={2} className="mt-1" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}