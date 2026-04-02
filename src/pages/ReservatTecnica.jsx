import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Trash2, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import RTKanban from "@/components/rt/RTKanban";
import RTPedidoForm from "@/components/rt/RTPedidoForm";
import RTTabela from "@/components/rt/RTTabela";

const STATUS_LABELS = {
  pendente: "Pendente",
  em_processo: "Em Processo",
  aguardando_nf: "Aguardando NF",
  lancado_movimentacao: "Lançado na Movimentação",
  pagamento_realizado: "Pagamento Realizado",
};

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
    <div className="space-y-6 min-h-screen" style={{ backgroundColor: "#1a1a2e" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Reserva Técnica</h1>
          <p className="text-sm text-gray-400">Gestão de comissões de arquitetos</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Novo Pedido RT
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-4 border border-gray-700 bg-gray-900/50 backdrop-blur">
          <p className="text-xs text-gray-400 mb-2">Total de RTs do Mês</p>
          <p className="text-2xl font-bold text-white">{kpis.totalRTs}</p>
        </div>
        <div className="rounded-xl p-4 border border-gray-700 bg-gray-900/50 backdrop-blur">
          <p className="text-xs text-gray-400 mb-2">Valor Total a Pagar</p>
          <p className="text-2xl font-bold text-white">R$ {kpis.valorTotal.toFixed(2).replace(".", ",")}</p>
        </div>
        <div className="rounded-xl p-4 border border-gray-700 bg-gray-900/50 backdrop-blur">
          <p className="text-xs text-gray-400 mb-2">Aguardando NF</p>
          <p className="text-2xl font-bold text-yellow-400">{kpis.aguardandoNF}</p>
        </div>
        <div className="rounded-xl p-4 border border-gray-700 bg-gray-900/50 backdrop-blur">
          <p className="text-xs text-gray-400 mb-2">Pagas no Mês</p>
          <p className="text-2xl font-bold text-emerald-400">{kpis.pagas}</p>
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex gap-2">
        <Button
          variant={view === "kanban" ? "default" : "outline"}
          onClick={() => setView("kanban")}
          className={view === "kanban" ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          Kanban
        </Button>
        <Button
          variant={view === "tabela" ? "default" : "outline"}
          onClick={() => setView("tabela")}
          className={view === "tabela" ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          Tabela
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          placeholder="Buscar por código ou arquiteto..."
          className="pl-9 bg-gray-900 border-gray-700 text-white"
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