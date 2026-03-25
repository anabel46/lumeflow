import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ShieldCheck, Clock, CheckCircle2, AlertTriangle, User,
  FileText, Package, ChevronRight, Palette, Layers, Hash, MapPin, Store
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, SECTOR_LABELS } from "@/lib/constants";

function ItemDetailCard({ po, products }) {
  const product = products.find(p => p.id === po.product_id);

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3",
      po.is_intermediate ? "bg-purple-50/40 border-purple-200" : "bg-card border-border"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {po.is_intermediate && <Package className="w-3.5 h-3.5 text-purple-500 shrink-0" />}
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">{po.unique_number}</span>
            <span className="font-semibold text-sm">{po.product_name}</span>
            {po.is_intermediate && <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">Intermediário</Badge>}
          </div>
        </div>
        <Badge variant="outline" className={cn("text-xs shrink-0", STATUS_COLORS[po.status])}>
          {STATUS_LABELS[po.status]}
        </Badge>
      </div>

      {/* Product description */}
      {product?.description && (
        <p className="text-xs text-muted-foreground bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 leading-relaxed">
          {product.description}
        </p>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {po.reference && (
          <div className="flex items-center gap-1.5">
            <Hash className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Ref:</span>
            <span className="font-semibold font-mono">{po.reference}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Qtd:</span>
          <span className="font-bold text-base text-foreground">{po.quantity}</span>
        </div>
        {po.color && (
          <div className="flex items-center gap-1.5">
            <Palette className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Cor:</span>
            <span className="font-semibold">{po.color}</span>
          </div>
        )}
        {po.complement && (
          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Compl:</span>
            <span className="font-semibold">{po.complement}</span>
          </div>
        )}
        {po.control && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Controle:</span>
            <span className="font-semibold">{po.control}</span>
          </div>
        )}
        {po.environment && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-muted-foreground" />
            <span className="font-semibold">{po.environment}</span>
          </div>
        )}
      </div>

      {/* Observations */}
      {po.observations && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-amber-600 font-medium mb-1">Obs. do comercial</p>
          <p className="text-xs text-amber-900 leading-snug">{po.observations}</p>
        </div>
      )}

      {/* Production sequence */}
      {po.production_sequence?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Rota de Produção</p>
          <div className="flex flex-wrap gap-1">
            {po.production_sequence.map((s, i) => (
              <React.Fragment key={i}>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium whitespace-nowrap">
                  {SECTOR_LABELS[s] || s}
                </span>
                {i < po.production_sequence.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40 self-center" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Technical drawing link */}
      {po.technical_drawing_url && (
        <a href={po.technical_drawing_url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
            <FileText className="w-3 h-3" /> Ver Desenho Técnico
          </Button>
        </a>
      )}
    </div>
  );
}

export default function ApprovalPanel({ order, productionOrders, orderId }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [managerName, setManagerName] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date", 500),
  });

  // Check current user role from SystemUser entity (by session/auth)
  const { data: currentUser } = useQuery({
    queryKey: ["auth-me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: systemUsers = [] } = useQuery({
    queryKey: ["system-users"],
    queryFn: () => base44.entities.SystemUser.list("name", 500),
  });

  // Find matching SystemUser by email
  const systemUser = systemUsers.find(u => u.email === currentUser?.email || u.name === currentUser?.full_name);
  const isManager = systemUser?.role === "admin" || systemUser?.role === "gerente" || currentUser?.role === "admin";

  const approveMutation = useMutation({
    mutationFn: () => base44.entities.Order.update(orderId, {
      status: "confirmado",
      approved_by: managerName || currentUser?.full_name || "Gerente",
      approved_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setShowDialog(false);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => base44.entities.Order.update(orderId, {
      status: "cancelado",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  if (order.status === "confirmado") {
    return (
      <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
        <div>
          <p className="font-semibold text-teal-800 text-sm">Pedido Confirmado — Produção Liberada</p>
          {order.approved_by && (
            <p className="text-xs text-teal-600">
              Aprovado por <strong>{order.approved_by}</strong>
              {order.approved_at && ` em ${format(new Date(order.approved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (order.status !== "aprovacao_pendente") return null;

  return (
    <>
      <div className={cn(
        "rounded-xl border-2 p-4 space-y-4",
        isManager ? "border-amber-300 bg-amber-50" : "border-amber-200 bg-amber-50/50"
      )}>
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900">Aprovação Pendente</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {isManager
                ? "Revise todos os itens abaixo e confirme ou cancele o pedido para liberar (ou não) a produção."
                : "Este pedido aguarda aprovação de um Gerente antes de entrar em produção."}
            </p>
          </div>
        </div>

        {/* Item details for manager review */}
        {isManager && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-amber-900 uppercase tracking-wider">Itens do Pedido para Revisão</p>
            {productionOrders.filter(po => !po.is_intermediate).map(po => (
              <ItemDetailCard key={po.id} po={po} products={products} />
            ))}
            {productionOrders.filter(po => po.is_intermediate).length > 0 && (
              <>
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mt-2">Intermediários</p>
                {productionOrders.filter(po => po.is_intermediate).map(po => (
                  <ItemDetailCard key={po.id} po={po} products={products} />
                ))}
              </>
            )}
          </div>
        )}

        {isManager && (
          <div className="flex gap-2 pt-2 border-t border-amber-200">
            <Button
              className="gap-2 bg-teal-600 hover:bg-teal-700 flex-1"
              onClick={() => setShowDialog(true)}
            >
              <CheckCircle2 className="w-4 h-4" /> Confirmar Pedido
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => { if (confirm("Cancelar este pedido?")) rejectMutation.mutate(); }}
              disabled={rejectMutation.isPending}
            >
              <AlertTriangle className="w-4 h-4" /> Cancelar
            </Button>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              Confirmar Aprovação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ao confirmar, o pedido <strong>#{order.order_number}</strong> será liberado para produção e as OPs poderão ser iniciadas pelos operadores.
            </p>
            <div>
              <Label className="text-xs">Seu nome (responsável pela aprovação)</Label>
              <div className="relative mt-1">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder={currentUser?.full_name || "Nome do gerente..."}
                  value={managerName}
                  onChange={e => setManagerName(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">Voltar</Button>
              <Button
                className="flex-1 gap-2 bg-teal-600 hover:bg-teal-700"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4" />
                {approveMutation.isPending ? "Confirmando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}