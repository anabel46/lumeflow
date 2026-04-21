import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Package, Activity } from "lucide-react";

const SITUACAO_STYLES = {
  "Aguardando aceite": "bg-amber-100 text-amber-700 border-amber-200",
  "Em andamento": "bg-blue-100 text-blue-700 border-blue-200",
  "Finalizada": "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function AtividadeRow({ atividade }) {
  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <Activity className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground font-mono">#{atividade.id}</span>
      <Badge variant="outline" className={cn("text-[10px] py-0 px-1.5", SITUACAO_STYLES[atividade.situacao] || "bg-muted text-muted-foreground")}>
        {atividade.situacao}
      </Badge>
      {atividade.dhInicio && (
        <span className="text-muted-foreground">
          Início: {new Date(atividade.dhInicio).toLocaleDateString("pt-BR")}
        </span>
      )}
    </div>
  );
}

function OpCard({ op }) {
  const [expanded, setExpanded] = useState(false);
  const total = op.atividades?.length || 0;
  const finalizadas = op.atividades?.filter(a => a.situacao === "Finalizada").length || 0;
  const statusGeral = op.atividades?.some(a => a.situacao === "Em andamento")
    ? "Em andamento"
    : op.atividades?.some(a => a.situacao === "Aguardando aceite")
    ? "Aguardando aceite"
    : finalizadas === total && total > 0
    ? "Finalizada"
    : "—";

  const pct = total > 0 ? Math.round((finalizadas / total) * 100) : 0;

  return (
    <div className="bg-muted/30 rounded-lg border border-border/60">
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors rounded-lg"
        onClick={() => setExpanded(v => !v)}
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
        <span className="text-xs font-bold font-mono text-primary">OP #{op.numeroOp}</span>
        <Badge variant="outline" className={cn("text-[10px] py-0 px-1.5", SITUACAO_STYLES[statusGeral] || "bg-muted text-muted-foreground")}>
          {statusGeral}
        </Badge>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">{finalizadas}/{total}</span>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
          {op.produtos?.length || 0} produto(s)
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t">
          {/* Atividades */}
          {op.atividades?.length > 0 && (
            <div className="pt-2 space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Atividades</p>
              {op.atividades.map(a => <AtividadeRow key={a.id} atividade={a} />)}
            </div>
          )}

          {/* Produtos */}
          {op.produtos?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Produtos desta OP</p>
              <div className="space-y-1">
                {op.produtos.map(p => (
                  <div key={p.codigo} className="flex items-start gap-2 text-xs bg-background rounded px-2 py-1.5 border border-border/40">
                    <Package className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium line-clamp-1">{p.descricao}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">Ref: {p.referencia}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">#{p.codigo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Painel completo de OPs Sankhya para um pedido.
 * ops: array retornado por getOpsByPedido(order_number)
 */
export default function SankhyaOpsPanel({ ops = [], loading = false, error = null }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-12 bg-muted/40 rounded-lg border animate-pulse" />)}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">
        Erro ao carregar dados do ERP: {error}
      </p>
    );
  }

  if (!ops || ops.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Nenhuma OP encontrada no Sankhya para este pedido.</p>;
  }

  return (
    <div className="space-y-2">
      {ops.map(op => <OpCard key={op.numeroOp} op={op} />)}
    </div>
  );
}