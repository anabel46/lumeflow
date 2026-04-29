import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Package } from "lucide-react";

/**
 * Editor de composição (matérias-primas) de um produto.
 * Cada item tem: nome, referência/código, quantidade, unidade.
 */
export default function CompositionEditor({ value = [], onChange }) {
  const [newItem, setNewItem] = useState({ name: "", reference: "", quantity: 1, unit: "un" });

  const handleAdd = () => {
    if (!newItem.name.trim()) return;
    onChange([...value, { ...newItem, quantity: Number(newItem.quantity) || 1 }]);
    setNewItem({ name: "", reference: "", quantity: 1, unit: "un" });
  };

  const handleRemove = (idx) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleChange = (idx, field, val) => {
    onChange(value.map((item, i) => i === idx ? { ...item, [field]: field === "quantity" ? Number(val) || 1 : val } : item));
  };

  const UNITS = ["un", "m", "m2", "kg", "l", "pç", "cm", "mm"];

  return (
    <div className="space-y-3">
      {/* Existing items */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
              <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 grid grid-cols-3 gap-2 min-w-0">
                <Input
                  value={item.name}
                  onChange={e => handleChange(idx, "name", e.target.value)}
                  placeholder="Nome da matéria-prima"
                  className="h-7 text-xs col-span-2"
                />
                <Input
                  value={item.reference || ""}
                  onChange={e => handleChange(idx, "reference", e.target.value)}
                  placeholder="Código/Ref."
                  className="h-7 text-xs"
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={item.quantity}
                  onChange={e => handleChange(idx, "quantity", e.target.value)}
                  className="h-7 text-xs w-16"
                />
                <select
                  value={item.unit || "un"}
                  onChange={e => handleChange(idx, "unit", e.target.value)}
                  className="h-7 text-xs border border-input rounded-md bg-background px-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => handleRemove(idx)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new item row */}
      <div className="flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-2 bg-background">
        <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 grid grid-cols-3 gap-2">
          <Input
            value={newItem.name}
            onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAdd())}
            placeholder="Nome da matéria-prima *"
            className="h-7 text-xs col-span-2"
          />
          <Input
            value={newItem.reference}
            onChange={e => setNewItem(p => ({ ...p, reference: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAdd())}
            placeholder="Código/Ref."
            className="h-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Input
            type="number"
            min={0.01}
            step={0.01}
            value={newItem.quantity}
            onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))}
            className="h-7 text-xs w-16"
          />
          <select
            value={newItem.unit}
            onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))}
            className="h-7 text-xs border border-input rounded-md bg-background px-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleAdd}
          disabled={!newItem.name.trim()}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {value.length > 0 && (
        <p className="text-[10px] text-muted-foreground">{value.length} matéria(s)-prima cadastrada(s)</p>
      )}
    </div>
  );
}