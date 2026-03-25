import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, FileText, Package, ChevronRight } from "lucide-react";
import ApprovalPanel from "@/components/orders/ApprovalPanel";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, SECTOR_LABELS } from "@/lib/constants";

export default function OrderDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);

  const { data: order } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => { const list = await base44.entities.Order.filter({ id }); return list[0]; },
  });

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-orders-by-order", id],
    queryFn: () => base44.entities.ProductionOrder.filter({ order_id: id }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date", 500),
  });

  const [itemForm, setItemForm] = useState({
    product_id: "", complement: "", control: "", color: "", quantity: 1, observations: ""
  });

  const createPOMutation = useMutation({
    mutationFn: async (data) => {
      const product = products.find(p => p.id === data.product_id);
      const unique = `OP-${Date.now().toString(36).toUpperCase()}`;

      // Create main production order
      const mainPO = await base44.entities.ProductionOrder.create({
        unique_number: unique,
        order_id: id,
        order_number: order?.order_number,
        product_id: data.product_id,
        reference: product?.reference || "",
        product_name: product?.name || "",
        complement: data.complement,
        control: data.control,
        color: data.color,
        quantity: data.quantity,
        cost_center: order?.cost_center,
        request_date: order?.request_date,
        environment: order?.environment,
        observations: data.observations,
        technical_drawing_url: product?.technical_drawing_url,
        production_sequence: product?.production_sequence || [],
        current_sector: product?.production_sequence?.[0] || "",
        current_step_index: 0,
        sector_status: "aguardando",
        status: "planejamento",
        delivery_deadline: order?.delivery_deadline,
        is_intermediate: false,
      });

      // Auto-create intermediate component orders
      const components = product?.components || [];
      for (const comp of components) {
        const compProduct = products.find(p => p.id === comp.product_id);
        const compQty = Math.ceil((comp.quantity_per_unit || 1) * data.quantity);
        const compUnique = `OP-${Date.now().toString(36).toUpperCase()}-INT`;
        await base44.entities.ProductionOrder.create({
          unique_number: compUnique,
          order_id: id,
          order_number: order?.order_number,
          product_id: comp.product_id,
          reference: comp.reference || compProduct?.reference || "",
          product_name: comp.name || compProduct?.name || "",
          quantity: compQty,
          cost_center: order?.cost_center,
          request_date: order?.request_date,
          environment: order?.environment,
          observations: `Intermediário para ${unique} - ${product?.name}`,
          technical_drawing_url: compProduct?.technical_drawing_url,
          production_sequence: compProduct?.production_sequence || [],
          current_sector: compProduct?.production_sequence?.[0] || "",
          current_step_index: 0,
          sector_status: "aguardando",
          status: "planejamento",
          delivery_deadline: order?.delivery_deadline,
          is_intermediate: true,
          parent_order_id: mainPO.id,
        });
      }

      return mainPO;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-orders-by-order", id] });
      setShowAddItem(false);
      setItemForm({ product_id: "", complement: "", control: "", color: "", quantity: 1, observations: "" });
    },
  });

  if (!order) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/pedidos"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold">Pedido #{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">{order.client_name}</p>
        </div>
        <Badge variant="outline" className={cn("ml-auto text-xs", STATUS_COLORS[order.status])}>
          {STATUS_LABELS[order.status]}
        </Badge>
      </div>

      {/* Order Info */}
      <div className="bg-card rounded-2xl border p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Solicitação</p>
          <p className="font-medium mt-1">{order.request_date ? format(new Date(order.request_date), "dd/MM/yyyy") : "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Prazo de Entrega</p>
          <p className="font-medium mt-1">
            {order.delivery_deadline ? format(new Date(order.delivery_deadline), "dd/MM/yyyy") : "-"}
            {order.delivery_type === "posterior" && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Posterior</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Centro de Custo</p>
          <p className="font-medium mt-1">{order.cost_center || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ambiente</p>
          <p className="font-medium mt-1">{order.environment || "-"}</p>
        </div>
        {order.observations && (
          <div className="col-span-full">
            <p className="text-xs text-muted-foreground">Observações do Comercial</p>
            <p className="font-medium mt-1">{order.observations}</p>
          </div>
        )}
      </div>

      {/* Approval Panel */}
      <ApprovalPanel order={order} productionOrders={productionOrders} orderId={id} />

      {/* Production Orders */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Ordens de Produção</h2>
        <Button onClick={() => setShowAddItem(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Adicionar Produto
        </Button>
      </div>

      <div className="space-y-3">
        {productionOrders.length === 0 ? (
          <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground">
            Nenhuma ordem de produção. Adicione produtos ao pedido.
          </div>
        ) : (
          (() => {
            const mainOrders = productionOrders.filter(po => !po.is_intermediate);
            const intermediates = productionOrders.filter(po => po.is_intermediate);
            return [...mainOrders, ...intermediates.filter(po => !mainOrders.some(m => m.id === po.parent_order_id))].map(po => {
              const children = intermediates.filter(c => c.parent_order_id === po.id);
              return (
                <div key={po.id} className={cn("bg-card rounded-2xl border p-4", po.is_intermediate && "border-purple-200 bg-purple-50/20 ml-6")}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 flex-wrap">
                       {po.is_intermediate && <Package className="w-3.5 h-3.5 text-purple-500" />}
                       <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">{po.unique_number}</span>
                       <span className="font-semibold">{po.product_name}</span>
                       {po.color && <Badge variant="outline" className="text-xs">{po.color}</Badge>}
                       {po.is_intermediate && <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">Intermediário</Badge>}
                     </div>
                     <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-muted-foreground">
                       {po.reference && <span>Ref: <strong className="text-foreground">{po.reference}</strong></span>}
                       <span>Qtd: <strong className="text-foreground">{po.quantity}</strong></span>
                       {po.complement && <span>Compl: <strong className="text-foreground">{po.complement}</strong></span>}
                       {po.control && <span>Controle: <strong className="text-foreground">{po.control}</strong></span>}
                       {po.current_sector && (
                         <span className="flex items-center gap-1">
                           <ChevronRight className="w-3 h-3" /> {SECTOR_LABELS[po.current_sector]}
                         </span>
                       )}
                     </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {po.technical_drawing_url && (
                        <a href={po.technical_drawing_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-1">
                            <FileText className="w-3 h-3" /> PDF
                          </Button>
                        </a>
                      )}
                      <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[po.status])}>
                        {STATUS_LABELS[po.status]}
                      </Badge>
                    </div>
                  </div>
                  {/* Child intermediates */}
                  {children.length > 0 && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Intermediários</p>
                      {children.map(child => (
                        <div key={child.id} className="flex items-center gap-2 text-xs bg-purple-50 rounded-lg px-3 py-2">
                          <Package className="w-3 h-3 text-purple-500 shrink-0" />
                          <span className="font-mono text-muted-foreground">{child.unique_number}</span>
                          <span className="font-medium flex-1">{child.product_name}</span>
                          <span className="text-muted-foreground">×{child.quantity}</span>
                          <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[child.status])}>
                            {STATUS_LABELS[child.status]}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()
        )}
      </div>

      {/* Add Item Dialog */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Produto ao Pedido</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createPOMutation.mutate(itemForm); }} className="space-y-4">
            <div>
              <Label>Produto *</Label>
              <Select value={itemForm.product_id} onValueChange={(v) => setItemForm(p => ({ ...p, product_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {products.filter(p => p.category !== "intermediario").map(p => <SelectItem key={p.id} value={p.id}>{p.reference} - {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* Show components preview */}
              {(() => {
                const sel = products.find(p => p.id === itemForm.product_id);
                const comps = sel?.components || [];
                if (!comps.length) return null;
                return (
                  <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-purple-700 mb-1.5 flex items-center gap-1">
                      <Package className="w-3 h-3" /> Intermediários gerados automaticamente:
                    </p>
                    {comps.map((c, i) => (
                      <p key={i} className="text-xs text-purple-600">• {c.name} ({c.reference}) × {c.quantity_per_unit} por unidade</p>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Complemento</Label><Input value={itemForm.complement} onChange={e => setItemForm(p => ({ ...p, complement: e.target.value }))} /></div>
              <div><Label>Controle</Label><Input value={itemForm.control} onChange={e => setItemForm(p => ({ ...p, control: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Cor</Label><Input value={itemForm.color} onChange={e => setItemForm(p => ({ ...p, color: e.target.value }))} /></div>
              <div><Label>Quantidade *</Label><Input type="number" min={1} value={itemForm.quantity} onChange={e => setItemForm(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} /></div>
            </div>
            <div><Label>Observações</Label><Input value={itemForm.observations} onChange={e => setItemForm(p => ({ ...p, observations: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddItem(false)}>Cancelar</Button>
              <Button type="submit" disabled={!itemForm.product_id}>Adicionar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}