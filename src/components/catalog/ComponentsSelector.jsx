import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Package } from "lucide-react";

/**
 * Selector for adding intermediate material components to a product.
 * products: list of all products (used to search intermediários)
 * value: current array of { product_id, reference, name, quantity_per_unit }
 * onChange: callback with new array
 */
export default function ComponentsSelector({ products = [], value = [], onChange }) {
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const intermediaries = products.filter(p =>
    p.category === "intermediario" || p.production_sequence?.length > 0
  );

  const filteredSearch = intermediaries.filter(p =>
    !value.some(c => c.product_id === p.id) &&
    (p.name?.toLowerCase().includes(search.toLowerCase()) || p.reference?.toLowerCase().includes(search.toLowerCase()))
  );

  const addComponent = (product) => {
    onChange([...value, {
      product_id: product.id,
      reference: product.reference,
      name: product.name,
      quantity_per_unit: 1,
    }]);
    setSearch("");
    setShowSearch(false);
  };

  const updateQty = (idx, qty) => {
    const updated = [...value];
    updated[idx] = { ...updated[idx], quantity_per_unit: parseFloat(qty) || 1 };
    onChange(updated);
  };

  const remove = (idx) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((comp, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
              <Package className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{comp.name}</p>
                <p className="text-[10px] text-muted-foreground">{comp.reference}</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Qtd/un:</span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={comp.quantity_per_unit}
                  onChange={(e) => updateQty(idx, e.target.value)}
                  className="w-16 h-7 text-xs px-2"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => remove(idx)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showSearch ? (
        <div className="space-y-2">
          <Input
            placeholder="Buscar produto/intermediário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
          <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
            {filteredSearch.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 text-center">
                {search ? "Nenhum resultado" : "Digite para buscar"}
              </p>
            ) : (
              filteredSearch.slice(0, 8).map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2"
                  onClick={() => addComponent(p)}
                >
                  <Package className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <div>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{p.reference}</span>
                    {p.category === "intermediario" && (
                      <Badge variant="outline" className="ml-2 text-[9px] border-purple-300 text-purple-700">Intermediário</Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setShowSearch(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs border-dashed"
          onClick={() => setShowSearch(true)}
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar Material Intermediário
        </Button>
      )}
    </div>
  );
}