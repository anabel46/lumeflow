import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ClipboardCheck, CheckCircle2, XCircle, RefreshCw, BarChart3, TrendingUp, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const resultColors = {
  aprovado: "bg-emerald-100 text-emerald-800",
  reprovado: "bg-red-100 text-red-800",
  retrabalho: "bg-amber-100 text-amber-800"
};
const resultIcons = { aprovado: CheckCircle2, reprovado: XCircle, retrabalho: RefreshCw };

// Checklist items configuráveis — exibidos aqui para referência
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
  const [search, setSearch] = useState("");

  const { data: checks = [] } = useQuery({
    queryKey: ["quality-checks"],
    queryFn: () => base44.entities.QualityCheck.list("-created_date", 500),
  });

  const totalChecks = checks.length;
  const aprovados = checks.filter(c => c.overall_result === "aprovado").length;
  const reprovados = checks.filter(c => c.overall_result === "reprovado").length;
  const retrabalhos = checks.filter(c => c.overall_result === "retrabalho").length;
  const approvalRate = totalChecks > 0 ? Math.round((aprovados / totalChecks) * 100) : 0;

  const filtered = checks.filter(c =>
    !search ||
    c.unique_number?.includes(search) ||
    c.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.inspector?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Controle de Qualidade</h1>
          <p className="text-sm text-muted-foreground">Histórico e configuração das inspeções — inspeções realizadas na Embalagem</p>
        </div>
      </div>

      {/* KPIs */}
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

      {/* Checklist config reference */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Itens do Checklist de Inspeção</h2>
          <p className="text-xs text-muted-foreground ml-2">(aplicado na Embalagem)</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {CHECK_ITEMS.map(item => (
            <div key={item.key} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Histórico */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Histórico de Inspeções</h2>
        <div className="relative max-w-sm mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar OP, produto, inspetor..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="space-y-2">
          {filtered.map((check) => {
            const Icon = resultIcons[check.overall_result] || CheckCircle2;
            return (
              <div key={check.id} className="bg-card rounded-xl border p-4 flex items-center gap-4">
                <Icon className={cn("w-5 h-5 shrink-0",
                  check.overall_result === "aprovado" ? "text-emerald-600" :
                  check.overall_result === "reprovado" ? "text-red-500" : "text-amber-500"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{check.unique_number} — {check.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Inspetor: {check.inspector || "-"} | {check.created_date ? format(new Date(check.created_date), "dd/MM/yyyy HH:mm") : ""}
                  </p>
                  {check.observations && <p className="text-xs text-muted-foreground truncate">{check.observations}</p>}
                </div>
                <Badge variant="outline" className={cn("text-xs shrink-0", resultColors[check.overall_result])}>
                  {check.overall_result}
                </Badge>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground">Nenhuma inspeção realizada</div>
          )}
        </div>
      </div>
    </div>
  );
}