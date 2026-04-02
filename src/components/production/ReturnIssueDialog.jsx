import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReturnIssueDialog({ open, po, onClose, onContinue, loading }) {
  const [hasIssues, setHasIssues] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [observations, setObservations] = useState("");

  const handleContinue = () => {
    const returnData = hasIssues ? {
      has_issues: true,
      issue_quantity: parseInt(quantity) || 0,
      issue_observations: observations,
    } : {
      has_issues: false,
    };
    onContinue(returnData);
  };

  const canContinue = !hasIssues || (quantity && parseInt(quantity) > 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Verificação de Retorno
          </DialogTitle>
          <DialogDescription>
            O setor anterior identificou problemas?
          </DialogDescription>
        </DialogHeader>

        {po && (
          <div className="bg-muted/60 rounded-lg p-3 mb-4 text-sm">
            <p className="font-semibold">{po.unique_number} — {po.product_name}</p>
            <p className="text-xs text-muted-foreground mt-1">Qtd: {po.quantity}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Yes/No buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setHasIssues(false);
                setQuantity("");
                setObservations("");
              }}
              className={cn(
                "py-3 rounded-lg border-2 font-medium transition-all",
                !hasIssues
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              )}
            >
              ✅ Não
            </button>
            <button
              onClick={() => setHasIssues(true)}
              className={cn(
                "py-3 rounded-lg border-2 font-medium transition-all",
                hasIssues
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              )}
            >
              ❌ Sim
            </button>
          </div>

          {/* Issue details */}
          {hasIssues && (
            <div className="space-y-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <div>
                <Label className="text-xs text-red-700 font-semibold">Quantidade com Problemas</Label>
                <Input
                  type="number"
                  min="1"
                  max={po?.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Ex: 2"
                  className="mt-1 bg-white border-red-200"
                />
              </div>
              <div>
                <Label className="text-xs text-red-700 font-semibold">Observações sobre o Problema</Label>
                <Textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Descreva os problemas encontrados..."
                  rows={3}
                  className="mt-1 bg-white border-red-200 text-sm"
                />
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!canContinue || loading}
              className={hasIssues ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}
            >
              {loading ? "Processando..." : "Continuar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}