import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle } from "lucide-react";

const COMPONENTES_EXCLUIVEIS = [
  { id: "fitas", nome: "Fitas", valor: 0 },
  { id: "drivers", nome: "Drivers", valor: 0 },
  { id: "lampadas", nome: "Lâmpadas", valor: 0 },
  { id: "kit_led", nome: "Kit Ponto de LED", valor: 0 },
];

export default function RTCalculator({ onCalculate, initialData }) {
  const [valorTotal, setValorTotal] = useState(initialData?.valor_total_pedido || 0);
  const [selectedItems, setSelectedItems] = useState({});
  const [componenteValues, setComponenteValues] = useState({});

  useEffect(() => {
    const valorComponentes = Object.entries(componenteValues)
      .filter(([key]) => selectedItems[key])
      .reduce((sum, [, val]) => sum + (val || 0), 0);

    const valorBase = Math.max(0, valorTotal - valorComponentes);
    const valorRT = valorBase * 0.1;

    onCalculate({
      valor_total_pedido: valorTotal,
      valor_componentes: valorComponentes,
      valor_base_rt: valorBase,
      valor_rt: valorRT,
    });
  }, [valorTotal, selectedItems, componenteValues, onCalculate]);

  const valorComponentes = Object.entries(componenteValues)
    .filter(([key]) => selectedItems[key])
    .reduce((sum, [, val]) => sum + (val || 0), 0);
  const valorBase = Math.max(0, valorTotal - valorComponentes);
  const valorRT = valorBase * 0.1;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Cálculo de RT</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Valor Total do Pedido</Label>
          <Input
            type="number"
            step="0.01"
            value={valorTotal}
            onChange={(e) => setValorTotal(parseFloat(e.target.value) || 0)}
            className="mt-1 bg-input"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Valor Base RT</Label>
          <div className="mt-1 px-3 py-2 bg-muted rounded-md border border-border text-sm font-semibold">
            R$ {valorBase.toFixed(2).replace(".", ",")}
          </div>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
        <Label className="text-xs font-semibold block mb-2">Componentes a Excluir do Cálculo</Label>
        <div className="space-y-2">
          {COMPONENTES_EXCLUIVEIS.map((comp) => (
            <div key={comp.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/70 transition">
              <Checkbox
                checked={selectedItems[comp.id] || false}
                onCheckedChange={(checked) =>
                  setSelectedItems((p) => ({ ...p, [comp.id]: checked }))
                }
              />
              <span className="text-sm flex-1">{comp.nome}</span>
              <Input
                type="number"
                step="0.01"
                placeholder="R$ 0,00"
                value={componenteValues[comp.id] || ""}
                onChange={(e) =>
                  setComponenteValues((p) => ({ ...p, [comp.id]: parseFloat(e.target.value) || 0 }))
                }
                className="w-24 h-8 text-xs bg-background"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Valor Componentes Excluídos</Label>
          <div className="mt-1 px-3 py-2 bg-muted rounded-md border border-border text-sm font-semibold">
            R$ {valorComponentes.toFixed(2).replace(".", ",")}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Valor RT (10%)</Label>
          <div className="mt-1 px-3 py-2 bg-emerald-900/30 rounded-md border border-emerald-500/50 text-sm font-bold text-emerald-300">
            R$ {valorRT.toFixed(2).replace(".", ",")}
          </div>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 flex gap-2">
        <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-200">
          A calculadora de RT exclui automaticamente os componentes marcados do valor base.
        </p>
      </div>
    </div>
  );
}