import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Package, MapPin, Store, Hash, Layers, Palette, MessageSquare, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SECTOR_LABELS, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";

function InfoRow({ icon: Icon, label, value, className }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-sm font-medium", className)}>{value}</p>
      </div>
    </div>
  );
}

export default function PODetailModal({ po, open, onClose }) {
  if (!po) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          {/* Order info block */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={Hash} label="Nº Pedido" value={po.order_number} />
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

          {/* Observations */}
          {po.observations && (
            <div className="flex items-start gap-2.5">
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Observações</p>
                <p className="text-sm mt-0.5 whitespace-pre-line">{po.observations}</p>
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

          {/* PDF */}
          {po.technical_drawing_url && (
            <a href={po.technical_drawing_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full gap-2">
                <FileText className="w-4 h-4" />
                Abrir Desenho Técnico (PDF)
              </Button>
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}