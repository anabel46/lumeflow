import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, MapPin, Store, Hash, Layers, Palette, MessageSquare, Calendar, AlignLeft } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SECTOR_LABELS, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";

function InfoRow({ icon: IconComp, label, value, className }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <IconComp className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-sm font-medium", className)}>{value}</p>
      </div>
    </div>
  );
}

export default function PODetailModal({ po, open, onClose }) {
  const { data: product } = useQuery({
    queryKey: ["product", po?.product_id],
    queryFn: () => base44.entities.Product.filter({ id: po.product_id }),
    enabled: !!po?.product_id,
    select: (data) => data?.[0],
  });

  if (!po) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-base">{po.unique_number}</span>
            {po.is_intermediate && (
              <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">Intermediário</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Product block */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Produto</p>
              <p className="text-lg font-bold">{po.product_name}</p>
              {po.reference && <p className="text-sm text-muted-foreground font-mono">Ref: {po.reference}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={Hash} label="Qtd" value={String(po.quantity)} />
              {po.color && <InfoRow icon={Palette} label="Cor / Acabamento" value={po.color} />}
              {po.complement && <InfoRow icon={Layers} label="Complemento" value={po.complement} />}
              {po.control && <InfoRow icon={Hash} label="Controle" value={po.control} />}
            </div>
          </div>

          {/* Product description */}
          {(product?.description) && (
            <div className="flex items-start gap-2.5 bg-sky-50 border border-sky-100 rounded-xl p-3">
              <AlignLeft className="w-3.5 h-3.5 text-sky-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-sky-600 font-medium">Descrição do Produto</p>
                <p className="text-sm mt-0.5 whitespace-pre-line text-sky-900">{product.description}</p>
              </div>
            </div>
          )}

          {/* Order info block */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={Hash} label="Nº Pedido" value={po.order_number} />
            {po.request_date && (
              <InfoRow icon={Calendar} label="Data de Solicitação" value={format(new Date(po.request_date), "dd/MM/yyyy")} />
            )}
            {po.cost_center && <InfoRow icon={Store} label="Loja / Centro de Custo" value={po.cost_center} />}
            {po.environment && <InfoRow icon={MapPin} label="Ambiente" value={po.environment} />}
            {po.delivery_deadline && (
              <InfoRow
                icon={Calendar}
                label="Prazo de Entrega"
                value={format(new Date(po.delivery_deadline), "dd/MM/yyyy")}
                className={new Date(po.delivery_deadline) < new Date() ? "text-red-600" : ""}
              />
            )}
          </div>

          {/* Commercial Observations */}
          {po.observations && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <MessageSquare className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-amber-600 font-medium">Observações do Comercial</p>
                <p className="text-sm mt-0.5 whitespace-pre-line text-amber-900">{po.observations}</p>
              </div>
            </div>
          )}

          {/* Production sequence */}
          {po.production_sequence?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Sequência de Produção</p>
              <div className="flex flex-wrap gap-1.5">
                {po.production_sequence.map((s, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      i < (po.current_step_index || 0)
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : s === po.current_sector
                        ? "bg-blue-100 text-blue-700 border-blue-300 ring-1 ring-blue-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {i + 1}. {SECTOR_LABELS[s] || s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-3 pt-1 border-t">
            <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[po.status])}>
              {STATUS_LABELS[po.status]}
            </Badge>
            {po.current_sector && (
              <span className="text-xs text-muted-foreground">
                Setor atual: <strong className="text-foreground">{SECTOR_LABELS[po.current_sector]}</strong>
              </span>
            )}
          </div>

          {/* PDF inline viewer */}
          {po.technical_drawing_url && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Desenho Técnico
              </p>
              <div className="rounded-xl overflow-hidden border bg-muted" style={{ height: 480 }}>
                <iframe
                  src={`${po.technical_drawing_url}#toolbar=0&navpanes=0&scrollbar=1`}
                  className="w-full h-full"
                  title="Desenho Técnico"
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}