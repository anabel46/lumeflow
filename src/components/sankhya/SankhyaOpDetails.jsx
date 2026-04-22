import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Package, Activity, ChevronDown, ChevronRight } from "lucide-react";

const SITUACAO_COLORS = {
  "Aguardando aceite": "bg-amber-100 text-amber-700 border-amber-200",
  "Em andamento": "bg-blue-100 text-blue-700 border-blue-200",
  "Finalizada": "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const STATUS_ICONS = {
  "Aguardando aceite": "⏳",
  "Em andamento": "⚙️",
  "Finalizada": "✅",
};

export default function SankhyaOpDetails({ op, expanded, onToggle }) {
  const produto = op.produtos?.[0];
  const atividadeAtual = op.atividades?.[0];

  return (
    <div className="bg-muted/30 rounded-lg border border-border/60 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono text-primary">
              OP-{op.numeroOp}
            </span>
            {atividadeAtual && (
              <Badge variant="outline" className="text-xs py-0 px-2">
                {op.descricaoAtividade || atividadeAtual.descricao}
              </Badge>
            )}
          </div>
          {produto && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {produto.descricao}
            </p>
          )}
        </div>

        {atividadeAtual && (
          <Badge
            variant="outline"
            className={cn("text-xs py-0 px-2 shrink-0", SITUACAO_COLORS[atividadeAtual.situacao])}
          >
            {STATUS_ICONS[atividadeAtual.situacao]} {atividadeAtual.situacao}
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t space-y-4 pt-4">
          {/* Atividades */}
          {op.atividades?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                Etapas de Produção
              </p>
              <div className="space-y-2">
                {op.atividades.map((ativ) => (
                  <div
                    key={ativ.id}
                    className={cn(
                      "flex items-start gap-3 px-3 py-2 rounded-lg border",
                      SITUACAO_COLORS[ativ.situacao] || "bg-muted/30 text-muted-foreground border-border/40"
                    )}
                  >
                    <Activity className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">
                        {ativ.descricao || `#${ativ.id}`}
                      </p>
                      <p className="text-[10px] opacity-75 mt-0.5">
                        {ativ.situacao}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Produtos */}
          {op.produtos?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                Produtos
              </p>
              <div className="space-y-2">
                {op.produtos.map((prod, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 px-3 py-2 rounded-lg bg-background border border-border/40"
                  >
                    <Package className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium line-clamp-2">
                        {prod.descricao}
                      </p>
                      {prod.referencia && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Ref: {prod.referencia}
                        </p>
                      )}
                    </div>
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