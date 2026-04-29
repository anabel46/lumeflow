import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2, Search, Filter, X, ChevronDown, ChevronUp,
  Package, ShieldCheck, Clock, ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, PURCHASE_LOCATIONS, SECTOR_LABELS } from "@/lib/constants";

// ── Order Row expandable ──────────────────────────────────────────────────────
function OrderRow({ order, productionOrders, selectedItems, onToggleItem, onToggleAll }) {
  const [expanded, setExpanded] = useState(true);

  const mainOps = productionOrders.filter(po => !po.is_intermediate);
  const selectableIds = mainOps.map(po => po.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedItems.has(id));
  const someSelected = selectableIds.some(id => selectedItems.has(id));

  return (
    <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
      {/* Order header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b">
        <div onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={allSelected}
            ref={el => { if (el) el.dataset.indeterminate = (!allSelected && someSelected) ? "true" : "false"; }}
            onCheckedChange={() => onToggleAll(selectableIds, allSelected)}
            disabled={selectableIds.length === 0}
            className="w-4 h-4"
          />
        </div>
        <button className="flex-1 flex items-center gap-3 text-left" onClick={() => setExpanded(e => !e)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">Pedido #{order.order_number}</span>
              <span className="text-sm text-muted-foreground">— {order.client_name}</span>
              <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[order.status])}>
                {STATUS_LABELS[order.status]}
              </Badge>
            </div>
            <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
              {order.request_date && <span>Solic.: {format(new Date(order.request_date), "dd/MM/yyyy")}</span>}
              {order.delivery_deadline && <span>Entrega: {format(new Date(order.delivery_deadline), "dd/MM/yyyy")}</span>}
              {order.purchase_location && <span className="capitalize">{order.purchase_location.replace(/_/g, " ")}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">{someSelected ? `${selectableIds.filter(id => selectedItems.has(id)).length}/` : ""}{mainOps.length} item(s)</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>
      </div>

      {/* Production orders list */}
      {expanded && (
        <div className="divide-y divide-border/40">
          {mainOps.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground italic">Nenhum produto adicionado a este pedido ainda.</p>
          ) : mainOps.map(po => (
            <div key={po.id} className={cn(
              "flex items-start gap-3 px-4 py-3 transition-colors",
              selectedItems.has(po.id) ? "bg-primary/5" : "hover:bg-muted/30"
            )}>
              <Checkbox
                checked={selectedItems.has(po.id)}
                onCheckedChange={() => onToggleItem(po.id)}
                className="mt-0.5 w-4 h-4"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded font-bold">{po.unique_number}</span>
                  {po.reference && <span className="text-xs font-semibold text-blue-600">{po.reference}</span>}
                  <span className="text-sm font-medium">{po.product_name}</span>
                  {po.color && <Badge variant="outline" className="text-[10px]">{po.color}</Badge>}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>Qtd: <strong className="text-foreground">{po.quantity}</strong></span>
                  {po.complement && <span>Compl: <strong className="text-foreground">{po.complement}</strong></span>}
                  {po.control && <span>Controle: <strong className="text-foreground">{po.control}</strong></span>}
                  {po.environment && <span>Amb: <strong className="text-foreground">{po.environment}</strong></span>}
                </div>
                {/* Production sequence */}
                {po.production_sequence?.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center">
                    {po.production_sequence.map((s, i) => (
                      <React.Fragment key={i}>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                          {SECTOR_LABELS[s] || s}
                        </span>
                        {i < po.production_sequence.length - 1 && (
                          <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/40" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
              <Badge variant="outline" className={cn("text-[10px] shrink-0 mt-0.5", STATUS_COLORS[po.status])}>
                {STATUS_LABELS[po.status]}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BulkApproval() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("aprovacao_pendente");
  const [filterLocation, setFilterLocation] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set()); // set of ProductionOrder IDs
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approverName, setApproverName] = useState("");

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => base44.entities.Order.list("-created_date", 500),
  });

  const { data: productionOrders = [], isLoading: posLoading } = useQuery({
    queryKey: ["productionOrders-all"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 9999),
  });

  const { data: currentUser } = useQuery({
    queryKey: ["auth-me"],
    queryFn: () => base44.auth.me(),
  });

  // Group POs by order_id
  const posByOrder = useMemo(() => {
    const map = {};
    productionOrders.forEach(po => {
      if (!map[po.order_id]) map[po.order_id] = [];
      map[po.order_id].push(po);
    });
    return map;
  }, [productionOrders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterLocation !== "all" && o.purchase_location !== filterLocation) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!o.order_number?.toLowerCase().includes(s) && !o.client_name?.toLowerCase().includes(s)) return false;
      }
      // Only show orders that have at least one production order
      const pos = posByOrder[o.id] || [];
      return pos.some(po => !po.is_intermediate);
    });
  }, [orders, filterStatus, filterLocation, search, posByOrder]);

  const handleToggleItem = (poId) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(poId) ? next.delete(poId) : next.add(poId);
      return next;
    });
  };

  const handleToggleAll = (ids, allSelected) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    const allIds = filteredOrders.flatMap(o =>
      (posByOrder[o.id] || []).filter(po => !po.is_intermediate).map(po => po.id)
    );
    const allSelected = allIds.every(id => selectedItems.has(id));
    if (allSelected) setSelectedItems(new Set());
    else setSelectedItems(new Set(allIds));
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      const selectedPOs = productionOrders.filter(po => selectedItems.has(po.id));
      // Group by order to know which orders to confirm
      const orderIds = [...new Set(selectedPOs.map(po => po.order_id))];

      // Update selected POs to "planejamento" / keep status (they are already planejamento)
      // Update the parent orders that had ALL their main POs selected → status confirmado
      // For orders where only some POs selected → keep in aprovacao_pendente but note partial
      for (const orderId of orderIds) {
        const orderMainPOs = (posByOrder[orderId] || []).filter(po => !po.is_intermediate);
        const selectedFromOrder = orderMainPOs.filter(po => selectedItems.has(po.id));
        const allSelected = selectedFromOrder.length === orderMainPOs.length;

        const order = orders.find(o => o.id === orderId);
        await base44.entities.Order.update(orderId, {
          status: "confirmado",
          approved_by: approverName || currentUser?.full_name || "Gerente",
          approved_at: new Date().toISOString(),
        });

        // Update unselected POs to "aguardando" (waiting)
        const unselectedFromOrder = orderMainPOs.filter(po => !selectedItems.has(po.id));
        for (const po of unselectedFromOrder) {
          await base44.entities.ProductionOrder.update(po.id, { status: "aguardando" });
        }

        // Update selected POs to planejamento (confirmed for production)
        for (const po of selectedFromOrder) {
          await base44.entities.ProductionOrder.update(po.id, { status: "planejamento" });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["productionOrders-all"] });
      queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
      setSelectedItems(new Set());
      setConfirmOpen(false);
    },
  });

  const selectedCount = selectedItems.size;
  const isLoading = ordersLoading || posLoading;

  const activeFilters = [filterStatus !== "aprovacao_pendente", filterLocation !== "all", search !== ""].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Aprovação em Lote</h1>
          <p className="text-sm text-muted-foreground">Selecione pedidos e produtos para liberar para produção</p>
        </div>
        {selectedCount > 0 && (
          <Button
            className="gap-2 bg-teal-600 hover:bg-teal-700"
            onClick={() => setConfirmOpen(true)}
          >
            <ShieldCheck className="w-4 h-4" />
            Aprovar {selectedCount} item(s)
          </Button>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nº ou cliente..." className="pl-9 h-9"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => setShowFilters(v => !v)}>
          <Filter className="w-4 h-4" /> Filtros
          {activeFilters > 0 && (
            <Badge className="h-5 w-5 p-0 text-[10px] flex items-center justify-center bg-primary rounded-full">
              {activeFilters}
            </Badge>
          )}
          {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
      </div>

      {showFilters && (
        <div className="bg-card border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status do pedido</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="aprovacao_pendente">Aprovação Pendente</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="em_producao">Em Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Loja</label>
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {PURCHASE_LOCATIONS.map(l => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Select all bar */}
      {filteredOrders.length > 0 && (
        <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
          <span className="text-xs text-muted-foreground">{filteredOrders.length} pedido(s) · {selectedCount} produto(s) selecionado(s)</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleSelectAllVisible}>
            {filteredOrders.flatMap(o => (posByOrder[o.id] || []).filter(po => !po.is_intermediate)).every(po => selectedItems.has(po.id))
              ? "Desmarcar todos" : "Selecionar todos visíveis"}
          </Button>
        </div>
      )}

      {/* Orders list */}
      {isLoading ? (
        <div className="text-center p-8 text-muted-foreground">Carregando...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-card rounded-2xl border p-8 text-center space-y-2">
          <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Nenhum pedido encontrado com os filtros selecionados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <OrderRow
              key={order.id}
              order={order}
              productionOrders={posByOrder[order.id] || []}
              selectedItems={selectedItems}
              onToggleItem={handleToggleItem}
              onToggleAll={handleToggleAll}
            />
          ))}
        </div>
      )}

      {/* Bulk approve dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              Confirmar Aprovação em Lote
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCount} produto(s) serão liberados para produção. Produtos não selecionados dentro do mesmo pedido ficarão com status <strong>Aguardando</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2">
            <label className="text-xs text-muted-foreground block mb-1">Responsável pela aprovação</label>
            <Input
              placeholder={currentUser?.full_name || "Seu nome..."}
              value={approverName}
              onChange={e => setApproverName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {approveMutation.isPending ? "Aprovando..." : `Aprovar ${selectedCount} item(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}