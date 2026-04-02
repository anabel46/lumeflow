import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Briefcase, DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import RTKanban from "@/components/rt/RTKanban";
import RTPedidoForm from "@/components/rt/RTPedidoForm";
import RTTabela from "@/components/rt/RTTabela";

export default function ReservatTecnica() {
  const [view, setView] = useState("kanban");
  const [showForm, setShowForm] = useState(false);
  const [editingPedido, setEditingPedido] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos_rt"],
    queryFn: () => base44.entities.Pedido_RT.list("-created_date", 500),
    refetchInterval: 30000,
  });

  const { data: arquitetos = [] } = useQuery({
    queryKey: ["arquitetos"],
    queryFn: () => base44.entities.Arquiteto.list("nome", 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Pedido_RT.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos_rt"] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pedido_RT.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos_rt"] });
      setEditingPedido(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Pedido_RT.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pedidos_rt"] }),
  });

  const getMesReferencia = () => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  };

  const pedidosMes = pedidos.filter((p) => p.mes_referencia === getMesReferencia());

  const kpis = {
    totalRTs: pedidosMes.length,
    valorTotal: pedidosMes.reduce((sum, p) => sum + (p.valor_rt || 0), 0),
    aguardandoNF: pedidosMes.filter((p) => p.status === "aguardando_nf").length,
    pagas: pedidosMes.filter((p) => p.status === "pagamento_realizado").length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reserva Técnica</h1>
            <p className="text-sm text-muted-foreground">Gestão de comissões de arquitetos</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Pedido RT
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total de RTs do Mês</p>
              <p className="text-2xl font-bold">{kpis.totalRTs}</p>
            </div>
            <Briefcase className="w-8 h-8 text-primary/20" />
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Valor Total a Pagar</p>
              <p className="text-2xl font-bold">R$ {kpis.valorTotal.toFixed(2).replace(".", ",")}</p>
            </div>
            <DollarSign className="w-8 h-8 text-success/20" />
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Aguardando NF</p>
              <p className="text-2xl font-bold text-warning">{kpis.aguardandoNF}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-warning/20" />
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Pagas no Mês</p>
              <p className="text-2xl font-bold text-success">{kpis.pagas}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-success/20" />
          </div>
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={view === "kanban" ? "default" : "outline"}
          onClick={() => setView("kanban")}
        >
          Kanban
        </Button>
        <Button
          variant={view === "tabela" ? "default" : "outline"}
          onClick={() => setView("tabela")}
        >
          Tabela
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código ou arquiteto..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {view === "kanban" ? (
        <RTKanban
          pedidos={pedidos}
          onEdit={setEditingPedido}
          onShowForm={() => setShowForm(true)}
          onDelete={(id) => deleteMutation.mutate(id)}
          search={search}
        />
      ) : (
        <RTTabela
          pedidos={pedidos}
          onEdit={setEditingPedido}
          search={search}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <RTPedidoForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          arquitetos={arquitetos}
          isLoading={createMutation.isPending}
        />
      )}

      {editingPedido && (
        <RTPedidoForm
          open={!!editingPedido}
          onClose={() => setEditingPedido(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingPedido.id, data })}
          initialData={editingPedido}
          arquitetos={arquitetos}
          isLoading={updateMutation.isPending}
        />
      )}
    </div>
  );
}