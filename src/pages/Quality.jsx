import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ClipboardCheck, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const CHECK_ITEMS = [
  { key: "visual_appearance", label: "Aparência Visual" },
  { key: "dimensions", label: "Dimensões" },
  { key: "finish_quality", label: "Qualidade do Acabamento" },
  { key: "paint_quality", label: "Qualidade da Pintura" },
  { key: "electrical_test", label: "Teste Elétrico" },
  { key: "assembly_integrity", label: "Integridade da Montagem" },
  { key: "packaging", label: "Embalagem" },
];

export default function Quality() {
  const [showForm, setShowForm] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: checks = [] } = useQuery({
    queryKey: ["quality-checks"],
    queryFn: () => base44.entities.QualityCheck.list("-created_date", 200),
  });

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-orders-qc"],
    queryFn: () => base44.entities.ProductionOrder.filter({ current_sector: "controle_qualidade", status: "em_producao" }),
  });

  const [form, setForm] = useState({
    production_order_id: "", unique_number: "", product_name: "", inspector: "",
    visual_appearance: "na", dimensions: "na", finish_quality: "na", paint_quality: "na",
    electrical_test: "na", assembly_integrity: "na", packaging: "na",
    overall_result: "aprovado", observations: "",
  });

  const createCheckMutation = useMutation({
    mutationFn: (data) => base44.entities.QualityCheck.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quality-checks"] }); setShowForm(false); },
  });

  const startCheck = (po) => {
    setSelectedPO(po);
    setForm(prev => ({
      ...prev,
      production_order_id: po.id,
      unique_number: po.unique_number,
      product_name: po.product_name,
    }));
    setShowForm(true);
  };

  const resultColors = { aprovado: "bg-emerald-100 text-emerald-800", reprovado: "bg-red-100 text-red-800", retrabalho: "bg-amber-100 text-amber-800" };
  const resultIcons = { aprovado: CheckCircle2, reprovado: XCircle, retrabalho: RefreshCw };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Controle de Qualidade</h1>
        <p className="text-sm text-muted-foreground">Verificação e aprovação de produtos</p>
      </div>

      {/* Pending QC */}
      {productionOrders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Aguardando Inspeção ({productionOrders.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {productionOrders.map((po) => (
              <div key={po.id} className="bg-card rounded-xl border p-4">
                <p className="font-mono text-xs text-muted-foreground">{po.unique_number}</p>
                <p className="font-semibold mt-1">{po.product_name}</p>
                <p className="text-xs text-muted-foreground mt-1">Pedido: {po.order_number} | Qtd: {po.quantity}</p>
                <Button size="sm" className="mt-3 w-full gap-1" onClick={() => startCheck(po)}>
                  <ClipboardCheck className="w-3.5 h-3.5" /> Inspecionar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Histórico de Inspeções</h2>
        <div className="relative max-w-sm mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="space-y-2">
          {checks.filter(c => !search || c.unique_number?.includes(search) || c.product_name?.toLowerCase().includes(search.toLowerCase())).map((check) => {
            const Icon = resultIcons[check.overall_result] || CheckCircle2;
            return (
              <div key={check.id} className="bg-card rounded-xl border p-4 flex items-center gap-4">
                <Icon className={cn("w-5 h-5", check.overall_result === "aprovado" ? "text-emerald-600" : check.overall_result === "reprovado" ? "text-red-500" : "text-amber-500")} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">{check.unique_number} - {check.product_name}</p>
                  <p className="text-xs text-muted-foreground">Inspetor: {check.inspector || "-"} | {check.created_date ? format(new Date(check.created_date), "dd/MM/yyyy HH:mm") : ""}</p>
                </div>
                <Badge variant="outline" className={cn("text-xs", resultColors[check.overall_result])}>{check.overall_result}</Badge>
              </div>
            );
          })}
          {checks.length === 0 && <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground">Nenhuma inspeção realizada</div>}
        </div>
      </div>

      {/* QC Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Formulário de Inspeção</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createCheckMutation.mutate(form); }} className="space-y-4">
            <div className="bg-muted rounded-lg p-3">
              <p className="font-semibold text-sm">{form.unique_number} - {form.product_name}</p>
            </div>
            <div><Label>Inspetor</Label><Input value={form.inspector} onChange={e => setForm(p => ({ ...p, inspector: e.target.value }))} /></div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Itens de Verificação</p>
              {CHECK_ITEMS.map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm">{item.label}</span>
                  <div className="flex gap-1">
                    {["aprovado", "reprovado", "na"].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, [item.key]: val }))}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium transition-all",
                          form[item.key] === val
                            ? val === "aprovado" ? "bg-emerald-500 text-white" : val === "reprovado" ? "bg-red-500 text-white" : "bg-gray-500 text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {val === "na" ? "N/A" : val === "aprovado" ? "OK" : "NOK"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label>Resultado Final</Label>
              <Select value={form.overall_result} onValueChange={v => setForm(p => ({ ...p, overall_result: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="reprovado">Reprovado</SelectItem>
                  <SelectItem value="retrabalho">Retrabalho</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} rows={3} /></div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit">Registrar Inspeção</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}