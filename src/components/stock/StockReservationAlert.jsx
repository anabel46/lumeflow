import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Package, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Analisa os componentes das OPs e exibe alertas de estoque insuficiente/baixo
 * antes da aprovação ou na tela de produção.
 */
export default function StockReservationAlert({ productionOrders = [], compact = false }) {
  const { data: stockItems = [] } = useQuery({
    queryKey: ["stock-items"],
    queryFn: () => base44.entities.StockItem.list("name", 500),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date", 500),
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ["stock-reservations"],
    queryFn: () => base44.entities.StockReservation.filter({ status: "ativa" }),
  });

  if (!stockItems.length || !products.length) return null;

  // Calcular demanda total de componentes para todas as OPs
  const demandMap = {};
  for (const po of productionOrders) {
    const product = products.find(p => p.id === po.product_id);
    const components = product?.components || [];
    for (const comp of components) {
      const stockItem = stockItems.find(
        s => s.code === comp.reference || s.name?.toLowerCase() === comp.name?.toLowerCase()
      );
      if (!stockItem) continue;
      const needed = (comp.quantity_per_unit || 1) * (po.quantity || 1);
      if (!demandMap[stockItem.id]) {
        demandMap[stockItem.id] = {
          stockItem,
          needed: 0,
          reserved: 0,
          name: comp.name || stockItem.name,
          code: comp.reference || stockItem.code,
        };
      }
      demandMap[stockItem.id].needed += needed;
    }
  }

  // Calcular quantidade já reservada por outros pedidos
  for (const res of reservations) {
    if (demandMap[res.stock_item_id]) {
      demandMap[res.stock_item_id].reserved += res.quantity_reserved || 0;
    }
  }

  const alerts = Object.values(demandMap).map(d => {
    const available = (d.stockItem.quantity_factory || 0) - d.reserved;
    const afterReserve = available - d.needed;
    const insufficient = available < d.needed;
    const willBeLow = !insufficient && afterReserve < (d.stockItem.minimum_stock || 0);
    return { ...d, available, afterReserve, insufficient, willBeLow };
  }).filter(d => d.insufficient || d.willBeLow);

  if (!alerts.length) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>Estoque suficiente para todos os componentes deste pedido.</span>
      </div>
    );
  }

  const hasInsufficient = alerts.some(a => a.insufficient);

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3",
      hasInsufficient ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
    )}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn("w-4 h-4 shrink-0", hasInsufficient ? "text-red-600" : "text-amber-600")} />
        <p className={cn("text-sm font-semibold", hasInsufficient ? "text-red-800" : "text-amber-800")}>
          {hasInsufficient ? "Estoque insuficiente para alguns componentes" : "Atenção: estoque ficará abaixo do mínimo"}
        </p>
      </div>
      <div className="space-y-2">
        {alerts.map(a => (
          <div key={a.stockItem.id} className={cn(
            "flex items-start gap-3 rounded-lg px-3 py-2 text-xs",
            a.insufficient ? "bg-red-100 border border-red-200" : "bg-amber-100 border border-amber-200"
          )}>
            <Package className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", a.insufficient ? "text-red-600" : "text-amber-600")} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{a.name} {a.code ? `(${a.code})` : ""}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-muted-foreground">
                <span>Em estoque: <strong className="text-foreground">{a.stockItem.quantity_factory || 0} {a.stockItem.unit}</strong></span>
                {a.reserved > 0 && <span>Reservado: <strong className="text-orange-600">{a.reserved} {a.stockItem.unit}</strong></span>}
                <span>Disponível: <strong className={a.available < a.needed ? "text-red-600" : "text-foreground"}>{a.available} {a.stockItem.unit}</strong></span>
                <span>Necessário: <strong className="text-foreground">{a.needed} {a.stockItem.unit}</strong></span>
                {a.stockItem.minimum_stock > 0 && <span>Mínimo: <strong className="text-foreground">{a.stockItem.minimum_stock} {a.stockItem.unit}</strong></span>}
              </div>
              {a.insufficient && (
                <p className="text-red-700 font-medium mt-0.5">
                  Falta: {a.needed - a.available} {a.stockItem.unit}
                </p>
              )}
              {a.willBeLow && !a.insufficient && (
                <p className="text-amber-700 font-medium mt-0.5">
                  Após reserva: {a.afterReserve} {a.stockItem.unit} (abaixo do mínimo)
                </p>
              )}
            </div>
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0",
              a.insufficient ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"
            )}>
              {a.insufficient ? "INSUF." : "BAIXO"}
            </span>
          </div>
        ))}
      </div>
      <p className={cn("text-xs", hasInsufficient ? "text-red-700" : "text-amber-700")}>
        <Info className="w-3 h-3 inline mr-1" />
        {hasInsufficient
          ? "Solicite reposição antes de iniciar a produção. A aprovação ainda pode ser feita, mas o início das OPs ficará bloqueado até regularização."
          : "O estoque ficará abaixo do nível mínimo após a reserva. Considere solicitar reposição."}
      </p>
    </div>
  );
}