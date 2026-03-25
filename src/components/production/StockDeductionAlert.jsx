import React from "react";
import { AlertTriangle, Package, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function StockDeductionAlert({ open, onClose, onConfirm, deductions, loading }) {
  if (!deductions) return null;

  const hasAlerts = deductions.some(d => d.willBeLow || d.insufficient);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Consumo de Insumos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ao iniciar esta OP, os seguintes insumos serão deduzidos do estoque fabril:
          </p>

          <div className="space-y-2">
            {deductions.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm",
                  d.insufficient ? "bg-red-50 border-red-200" : d.willBeLow ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-100"
                )}
              >
                <div>
                  <p className="font-medium">{d.name} <span className="text-muted-foreground font-mono text-xs">({d.code})</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Estoque atual: {d.currentStock} {d.unit} → após: {Math.max(0, d.currentStock - d.needed)} {d.unit}
                  </p>
                </div>
                <div className="ml-3 shrink-0">
                  {d.insufficient ? (
                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs gap-1">
                      <AlertTriangle className="w-3 h-3" /> Insuficiente
                    </Badge>
                  ) : d.willBeLow ? (
                    <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs gap-1">
                      <AlertTriangle className="w-3 h-3" /> Abaixo do mínimo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs gap-1">
                      <CheckCircle2 className="w-3 h-3" /> OK
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasAlerts && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Atenção: alguns itens estão com estoque abaixo do nível mínimo. A produção pode ser iniciada, mas é necessário repor o estoque.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={onConfirm} disabled={loading}>
              {loading ? "Iniciando..." : "Confirmar e Iniciar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}