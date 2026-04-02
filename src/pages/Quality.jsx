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
import { Search, ClipboardCheck, CheckCircle2, XCircle, RefreshCw, AlertTriangle, BarChart3, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { SECTORS, SECTOR_LABELS } from "@/lib/constants";
import { useNotifications } from "@/lib/NotificationContext";

const CHECK_ITEMS = [
  { key: "visual_appearance", label: "Aparência Visual" },
  { key: "dimensions", label: "Dimensões" },
  { key: "finish_quality", label: "Qualidade do Acabamento" },
  { key: "paint_quality", label: "Qualidade da Pintura" },
  { key: "electrical_test", label: "Teste Elétrico" },
  { key: "assembly_integrity", label: "Integridade da Montagem" },
  { key: "packaging", label: "Embalagem" },
];

const resultColors = { aprovado: "bg-emerald-100 text-emerald-800", reprovado: "bg-red-100 text-red-800", retrabalho: "bg-amber-100 text-amber-800" };
const resultIcons = { aprovado: CheckCircle2, reprovado: XCircle, retrabalho: RefreshCw };

export default function Quality() {
  const [showForm, setShowForm] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { notify } = useNotifications();

  const { data: checks = [] } = useQuery({
    queryKey: ["quality-checks"],
    queryFn: () => base44.entities.QualityCheck.list("-created_date", 200),
  });

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-orders-qc"],
    queryFn: () => base44.entities.ProductionOrder.filter({ current_sector: "controle_qualidade" }),
  });

  const [form, setForm] = useState({
    inspector: "",
    visual_appearance: "na", dimensions: "na", finish_quality: "na", paint_quality: "na",
    electrical_test: "na", assembly_integrity: "na", packaging: "na",
    overall_result: "aprovado", observations: "",
    correction_sector: "",
  });

  const createCheckMutation = useMutation({
    mutationFn: async (data) => {
      const { correction_sector, ...checkData } = data;

      // Save quality check
      await base44.entities.QualityCheck.create({
        production_order_id: selectedPO.id,
        unique_number: selectedPO.unique_number,
        product_name: selectedPO.product_name,
        ...checkData,
      });

      // Handle result
      if (checkData.overall_result === "aprovado") {
        // Advance to next sector
        const nextIndex = (selectedPO.current_step_index || 0) + 1;
        const sequence = selectedPO.production_sequence || [];
        if (nextIndex >= sequence.length) {
          await base44.entities.ProductionOrder.update(selectedPO.id, {
            status: "finalizado",
            sector_status: "concluido",
            current_sector: "",
            finished_at: new Date().toISOString(),
          });
        } else {
          await base44.entities.ProductionOrder.update(selectedPO.id, {
            current_step_index: nextIndex,
            current_sector: sequence[nextIndex],
            sector_status: "aguardando",
            sector_started_at: null,
          });
        }
      } else if (checkData.overall_result === "reprovado" && correction_sector) {
        // Send back to correction sector
        await base44.entities.ProductionOrder.update(selectedPO.id, {
          current_sector: correction_sector,
          sector_status: "aguardando",
          sector_started_at: null,
          status: "em_producao",
        });
        // Log retrabalho
        await base44.entities.SectorLog.create({
          production_order_id: selectedPO.id,
          unique_number: selectedPO.unique_number,
          sector: "controle_qualidade",
          action: "retrabalho",
          observations: `Reprovado. Retornando para: ${SECTOR_LABELS[correction_sector]}. ${checkData.observations || ""}`,
          timestamp: new Date().toISOString(),
        });
        notify(
          `OP Reprovada — ${selectedPO.product_name}`,
          "rejection",
          {
            unique_number: selectedPO.unique_number,
            product_name: selectedPO.product_name,
          }
        );
      } else if (checkData.overall_result === "retrabalho" && correction_sector) {
        // Retrabalho: send to correction sector
        await base44.entities.ProductionOrder.update(selectedPO.id, {
          current_sector: correction_sector,
          sector_status: "aguardando",
          sector_started_at: null,
          status: "em_producao",
        });
        await base44.entities.SectorLog.create({
          production_order_id: selectedPO.id,
          unique_number: selectedPO.unique_number,
          sector: "controle_qualidade",
          action: "retrabalho",
          observations: `Retrabalho solicitado. Setor: ${SECTOR_LABELS[correction_sector]}. ${checkData.observations || ""}`,
          timestamp: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-checks"] });
      queryClient.invalidateQueries({ queryKey: ["production-orders-qc"] });
      setShowForm(false);
      setSelectedPO(null);
      setForm({ inspector: "", visual_appearance: "na", dimensions: "na", finish_quality: "na", paint_quality: "na", electrical_test: "na", assembly_integrity: "na", packaging: "na", overall_result: "aprovado", observations: "", correction_sector: "" });
    },
  });

  const startCheck = (po) => {
    setSelectedPO(po);
    setShowForm(true);
  };

  const needsCorrectionSector = form.overall_result === "reprovado" || form.overall_result === "retrabalho";

  // Dashboard statistics
  const totalChecks = checks.length;
  const aprovados = checks.filter(c => c.overall_result === "aprovado").length;
  const reprovados = checks.filter(c => c.overall_result === "reprovado").length;
  const retrabalhos = checks.filter(c => c.overall_result === "retrabalho").length;
  const approvalRate = totalChecks > 0 ? Math.round((aprovados / totalChecks) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Controle de Qualidade</h1>
          <p className="text-sm text-muted-foreground">Verificação e aprovação de produtos</p>
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total de Inspeções</p>
              <p className="text-2xl font-bold">{totalChecks}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-primary/20" />
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Aprovados</p>
              <p className="text-2xl font-bold text-emerald-600">{aprovados}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-emerald-500/20" />
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Retrabalhos</p>
              <p className="text-2xl font-bold text-amber-600">{retrabalhos}</p>
            </div>
            <RefreshCw className="w-8 h-8 text-amber-500/20" />
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Taxa de Aprovação</p>
              <p className="text-2xl font-bold text-blue-600">{approvalRate}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500/20" />
          </div>
        </div>
      </div>

      {/* Pending QC */}
      {productionOrders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Aguardando Inspeção ({productionOrders.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {productionOrders.map((po) => (
              <div key={po.id} className="bg-card rounded-xl border p-4">
                <p className="font-mono text-xs text-muted-foreground">{po.unique_number}</p>
                <p className="font-semibold mt-1">{po.product_name}</p>
                <p className="text-xs text-muted-foreground mt-1">Pedido: {po.order_number} | Qtd: {po.quantity}</p>
                {po.color && <p className="text-xs text-muted-foreground">Cor: {po.color}</p>}
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
                <Icon className={cn("w-5 h-5 shrink-0", check.overall_result === "aprovado" ? "text-emerald-600" : check.overall_result === "reprovado" ? "text-red-500" : "text-amber-500")} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{check.unique_number} — {check.product_name}</p>
                  <p className="text-xs text-muted-foreground">Inspetor: {check.inspector || "-"} | {check.created_date ? format(new Date(check.created_date), "dd/MM/yyyy HH:mm") : ""}</p>
                  {check.observations && <p className="text-xs text-muted-foreground truncate">{check.observations}</p>}
                </div>
                <Badge variant="outline" className={cn("text-xs shrink-0", resultColors[check.overall_result])}>
                  {check.overall_result}
                </Badge>
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
          {selectedPO && (
            <form onSubmit={(e) => { e.preventDefault(); createCheckMutation.mutate(form); }} className="space-y-4">
              <div className="bg-muted rounded-lg p-3">
                <p className="font-semibold text-sm">{selectedPO.unique_number} — {selectedPO.product_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Pedido: {selectedPO.order_number} | Qtd: {selectedPO.quantity}{selectedPO.color ? ` | Cor: ${selectedPO.color}` : ""}</p>
              </div>

              <div>
                <Label>Inspetor</Label>
                <Input value={form.inspector} onChange={e => setForm(p => ({ ...p, inspector: e.target.value }))} className="mt-1" />
              </div>

              <div className="space-y-1">
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
                              ? val === "aprovado" ? "bg-emerald-500 text-white" : val === "reprovado" ? "bg-red-500 text-white" : "bg-gray-400 text-white"
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
                <Select value={form.overall_result} onValueChange={v => setForm(p => ({ ...p, overall_result: v, correction_sector: "" }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aprovado">✅ Aprovado</SelectItem>
                    <SelectItem value="retrabalho">🔁 Retrabalho</SelectItem>
                    <SelectItem value="reprovado">❌ Reprovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Correction sector — only when reprovado or retrabalho */}
              {needsCorrectionSector && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Setor de Correção *</span>
                  </div>
                  <p className="text-xs text-amber-700">Selecione o setor responsável pela correção. A OP será enviada de volta para este setor.</p>
                  <Select value={form.correction_sector} onValueChange={v => setForm(p => ({ ...p, correction_sector: v }))}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                    <SelectContent>
                      {SECTORS.filter(s => s.id !== "controle_qualidade" && s.id !== "embalagem").map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Observações</Label>
                <Textarea value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} rows={3} className="mt-1" placeholder="Descreva os defeitos encontrados ou motivo da reprovação..." />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button
                  type="submit"
                  disabled={createCheckMutation.isPending || (needsCorrectionSector && !form.correction_sector)}
                  className={cn(form.overall_result === "reprovado" ? "bg-red-600 hover:bg-red-700" : form.overall_result === "retrabalho" ? "bg-amber-600 hover:bg-amber-700" : "")}
                >
                  {createCheckMutation.isPending ? "Salvando..." : "Registrar Inspeção"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}