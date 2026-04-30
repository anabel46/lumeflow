import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Eye, Filter, X, Ban, Trash2, AlertTriangle, ChevronDown, ChevronUp, ShieldCheck, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, PURCHASE_LOCATIONS } from "@/lib/constants";
import OrderForm from "@/components/orders/OrderForm";
import { Link } from "react-router-dom";
import { useSankhyaData } from "@/hooks/useSankhyaData";
import SankhyaOpBadge from "@/components/sankhya/SankhyaOpBadge";

export default function Orders() {
  const { getOpsByPedido, loading: sankhyaLoading } = useSankhyaData();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const handleSyncPedidos = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke("sankhyaSyncPedidos", {});
      setSyncResult(res.data);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (err) {
      setSyncResult({ error: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null); // { type: 'cancel'|'delete', order }

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => base44.entities.Order.list("-created_date", 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Order.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["orders"] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["orders"] }); setEditingOrder(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Order.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["orders"] }); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => base44.entities.Order.update(id, { status: "cancelado" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["orders"] }); },
  });

  const handleConfirm = async () => {
    if (!confirmDialog) return;
    const { type, order } = confirmDialog;
    if (type === "cancel") await cancelMutation.mutateAsync(order.id);
    else if (type === "delete") await deleteMutation.mutateAsync(order.id);
    setConfirmDialog(null);
  };

  const activeFiltersCount = [
    filterStatus !== "all",
    filterLocation !== "all",
    filterDateFrom !== "",
    filterDateTo !== "",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterLocation("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSearch("");
  };

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (search) {
        const s = search.toLowerCase();
        if (!o.order_number?.toLowerCase().includes(s) && !o.client_name?.toLowerCase().includes(s)) return false;
      }
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterLocation !== "all" && o.purchase_location !== filterLocation) return false;
      if (filterDateFrom) {
        const rd = o.request_date ? new Date(o.request_date) : null;
        if (!rd || rd < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const rd = o.request_date ? new Date(o.request_date) : null;
        if (!rd || rd > new Date(filterDateTo + "T23:59:59")) return false;
      }
      return true;
    });
  }, [orders, search, filterStatus, filterLocation, filterDateFrom, filterDateTo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Gerenciar pedidos de clientes</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncPedidos}
              disabled={syncing}
              className="gap-2 h-9 text-xs"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
              {syncing ? "Sincronizando..." : "Sincronizar ERP"}
            </Button>
            <Link to="/aprovacao-lote">
              <Button variant="outline" className="gap-2">
                <ShieldCheck className="w-4 h-4" /> Aprovação em Lote
              </Button>
            </Link>
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Pedido
            </Button>
          </div>
          {syncResult && (
            <p className={cn("text-[11px]", syncResult.error ? "text-destructive" : "text-emerald-600")}>
              {syncResult.error
                ? `Erro: ${syncResult.error}`
                : `✓ ${syncResult.inserted ?? 0} inseridos · ${syncResult.updated ?? 0} atualizados · ${syncResult.total ?? 0} total`}
            </p>
          )}
        </div>
      </div>

      {/* Search + Filter Toggle */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nº ou cliente..." className="pl-9 h-9"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-2"
          onClick={() => setShowFilters(v => !v)}>
          <Filter className="w-4 h-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge className="h-5 w-5 p-0 text-[10px] flex items-center justify-center bg-primary text-primary-foreground rounded-full">
              {activeFiltersCount}
            </Badge>
          )}
          {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
        {(activeFiltersCount > 0 || search) && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground" onClick={clearFilters}>
            <X className="w-3.5 h-3.5" /> Limpar
          </Button>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-card border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="aprovacao_pendente">Aprovação Pendente</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="em_producao">Em Produção</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Loja / Local</label>
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as lojas</SelectItem>
                {PURCHASE_LOCATIONS.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data solicitação — início</label>
            <Input type="date" className="h-8 text-xs" value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data solicitação — fim</label>
            <Input type="date" className="h-8 text-xs" value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)} />
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-muted-foreground">{filtered.length} pedido(s) encontrado(s)</p>

      {/* Table */}
      <div className="bg-card rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-medium text-muted-foreground">Nº Pedido</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Solicitação</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Prazo</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center p-8 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center p-8 text-muted-foreground">Nenhum pedido encontrado</td></tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className={cn(
                    "border-b hover:bg-muted/60 transition-colors",
                    order.status === "cancelado" && "opacity-60"
                  )}>
                    <td className="p-4 font-semibold">{order.order_number}</td>
                    <td className="p-4">{order.client_name}</td>
                    <td className="p-4">{order.request_date ? format(new Date(order.request_date), "dd/MM/yyyy") : "-"}</td>
                    <td className="p-4">{order.delivery_deadline ? format(new Date(order.delivery_deadline), "dd/MM/yyyy") : "-"}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={cn("text-xs w-fit", STATUS_COLORS[order.status])}>
                          {STATUS_LABELS[order.status] || order.status}
                        </Badge>
                        <SankhyaOpBadge ops={getOpsByPedido(order.order_number)} loading={sankhyaLoading} />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 items-center">
                        <Link to={`/pedidos/${order.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs"
                          onClick={() => setEditingOrder(order)}>
                          Editar
                        </Button>
                        {order.status !== "cancelado" && (
                          <Button variant="ghost" size="sm"
                            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Cancelar pedido"
                            onClick={() => setConfirmDialog({ type: "cancel", order })}>
                            <Ban className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Excluir pedido"
                          onClick={() => setConfirmDialog({ type: "delete", order })}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={(o) => !o && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {confirmDialog?.type === "delete" ? "Excluir pedido?" : "Cancelar pedido?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.type === "delete"
                ? `O pedido #${confirmDialog?.order?.order_number} será excluído permanentemente. Esta ação não pode ser desfeita.`
                : `O pedido #${confirmDialog?.order?.order_number} será marcado como cancelado.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={confirmDialog?.type === "delete"
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-amber-500 hover:bg-amber-600"
              }>
              {confirmDialog?.type === "delete" ? "Excluir" : "Cancelar Pedido"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showForm && (
        <OrderForm open={showForm} onClose={() => setShowForm(false)}
          onSubmit={(data) => createMutation.mutate(data)} />
      )}
      {editingOrder && (
        <OrderForm open={!!editingOrder} onClose={() => setEditingOrder(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingOrder.id, data })}
          initialData={editingOrder} />
      )}
    </div>
  );
}