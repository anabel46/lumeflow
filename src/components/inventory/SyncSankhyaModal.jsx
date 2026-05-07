import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Database, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function SyncSankhyaModal({ open, onClose, session, divergentItems }) {
  const handleConfirm = () => {
    // Aqui seria chamada a função backend para sincronizar com Sankhya
    toast.info("Sincronização com Sankhya será implementada em breve");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Sincronizar com Sankhya
          </DialogTitle>
          <DialogDescription>
            Os ajustes de estoque serão enviados para o sistema ERP Sankhya.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 mb-1">Atenção:</p>
              <p className="text-amber-700">
                Esta ação enviará {divergentItems.length} ajuste(s) de estoque para o Sankhya.
                Certifique-se de que todas as contagens foram verificadas.
              </p>
            </div>
          </div>

          {divergentItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Itens que serão ajustados:</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {divergentItems.map((item) => {
                  const diff = (item.quantity_revised || 0) - (item.quantity_current || 0);
                  return (
                    <div key={item.id} className="flex items-center justify-between text-xs p-2 bg-muted rounded">
                      <div className="flex-1 min-w-0">
                        <span className="font-mono">{item.item_code}</span>
                        <span className="ml-2 text-muted-foreground truncate">{item.item_name}</span>
                      </div>
                      <Badge variant="outline" className={diff > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}>
                        {diff > 0 ? "+" : ""}{diff}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Status atual: {session.sankhya_sync_status || "pendente"}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} className="gap-2">
            <Database className="w-4 h-4" /> Confirmar Sincronização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}