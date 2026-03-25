import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import OrderForm from "@/components/orders/OrderForm";
import { Link } from "react-router-dom";

export default function Orders() {
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => base44.entities.Order.list("-created_date", 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Order.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["orders"] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["orders"] }); setEditingOrder(null); },
  });

  const filtered = orders.filter(o =>
    o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Gerenciar pedidos de clientes</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Pedido
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nº ou cliente..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

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
                  <tr key={order.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-semibold">{order.order_number}</td>
                    <td className="p-4">{order.client_name}</td>
                    <td className="p-4">{order.request_date ? format(new Date(order.request_date), "dd/MM/yyyy") : "-"}</td>
                    <td className="p-4">{order.delivery_deadline ? format(new Date(order.delivery_deadline), "dd/MM/yyyy") : "-"}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[order.status])}>
                        {STATUS_LABELS[order.status] || order.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Link to={`/pedidos/${order.id}`}>
                          <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => setEditingOrder(order)}>Editar</Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <OrderForm open={showForm} onClose={() => setShowForm(false)} onSubmit={(data) => createMutation.mutate(data)} />
      )}
      {editingOrder && (
        <OrderForm
          open={!!editingOrder}
          onClose={() => setEditingOrder(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingOrder.id, data })}
          initialData={editingOrder}
        />
      )}
    </div>
  );
}