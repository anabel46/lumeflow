import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, SECTOR_LABELS } from "@/lib/constants";
import { Link } from "react-router-dom";
import { ExternalLink, Package, ChevronRight } from "lucide-react";

export default function DrillDownModal({ open, onClose, title, subtitle, productionOrders = [], orders = [] }) {
  // Dedupe orders referenced by the POs
  const orderIds = [...new Set(productionOrders.map(po => po.order_id).filter(Boolean))];
  const relatedOrders = orders.filter(o => orderIds.includes(o.id));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-5 pr-1">
          {/* Summary chips */}
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1"><Package className="w-3 h-3" />{productionOrders.length} OPs</Badge>
            <Badge variant="outline" className="gap-1">
              <ExternalLink className="w-3 h-3" />{relatedOrders.length} pedido{relatedOrders.length !== 1 ? "s" : ""}
            </Badge>
          </div>

          {/* Pedidos */}
          {relatedOrders.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pedidos</p>
              <div className="space-y-1.5">
                {relatedOrders.map(order => (
                  <Link key={order.id} to={`/pedidos/${order.id}`} onClick={onClose}>
                    <div className="flex items-center justify-between gap-3 bg-muted/50 hover:bg-muted rounded-xl px-3 py-2.5 transition-colors cursor-pointer">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold">#{order.order_number}</span>
                          <span className="text-sm font-medium truncate">{order.client_name}</span>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          {order.request_date && <span>Solicitação: {format(new Date(order.request_date), "dd/MM/yyyy")}</span>}
                          {order.delivery_deadline && <span>Prazo: {format(new Date(order.delivery_deadline), "dd/MM/yyyy")}</span>}
                          {order.cost_center && <span>{order.cost_center}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[order.status])}>
                          {STATUS_LABELS[order.status]}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* OPs */}
          {productionOrders.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Ordens de Produção</p>
              <div className="space-y-1.5">
                {productionOrders.map(po => (
                  <div key={po.id} className="bg-muted/40 rounded-xl px-3 py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold bg-muted px-2 py-0.5 rounded">{po.unique_number}</span>
                        <span className="text-sm font-medium truncate">{po.product_name}</span>
                        {po.is_intermediate && (
                          <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-600">Intermediário</Badge>
                        )}
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>Pedido: <strong className="text-foreground">{po.order_number}</strong></span>
                        <span>Qtd: <strong className="text-foreground">{po.quantity}</strong></span>
                        {po.current_sector && (
                          <span className="flex items-center gap-1">
                            <ChevronRight className="w-3 h-3" />{SECTOR_LABELS[po.current_sector] || po.current_sector}
                          </span>
                        )}
                        {po.delivery_deadline && (
                          <span className={cn(new Date(po.delivery_deadline) < new Date() && po.status !== "finalizado" ? "text-red-500 font-semibold" : "")}>
                            Prazo: {format(new Date(po.delivery_deadline), "dd/MM/yy")}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("text-xs shrink-0", STATUS_COLORS[po.status])}>
                      {STATUS_LABELS[po.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {productionOrders.length === 0 && relatedOrders.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum item encontrado.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}