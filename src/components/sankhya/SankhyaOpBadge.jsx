import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SITUACAO_STYLES = {
  "Aguardando aceite": "bg-amber-100 text-amber-700 border-amber-200",
  "Em andamento": "bg-blue-100 text-blue-700 border-blue-200",
  "Finalizada": "bg-emerald-100 text-emerald-700 border-emerald-200",
};

/**
 * Exibe um mini-resumo das OPs Sankhya para um determinado número de pedido.
 * ops: array de OPs retornado por getOpsByPedido(numeroPedido)
 */
export default function SankhyaOpBadge({ ops = [], loading = false }) {
  if (loading) {
    return <span className="inline-block w-16 h-4 bg-muted animate-pulse rounded" />;
  }
  if (!ops || ops.length === 0) return null;

  const total = ops.reduce((acc, op) => acc + (op.atividades?.length || 0), 0);
  const finalizadas = ops.reduce((acc, op) => acc + (op.atividades?.filter(a => a.situacao === "Finalizada").length || 0), 0);
  const emAndamento = ops.reduce((acc, op) => acc + (op.atividades?.filter(a => a.situacao === "Em andamento").length || 0), 0);
  const aguardando = total - finalizadas - emAndamento;

  const situacao = emAndamento > 0
    ? "Em andamento"
    : aguardando > 0
    ? "Aguardando aceite"
    : "Finalizada";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Badge
        variant="outline"
        className={cn("text-[10px] py-0 px-1.5 gap-1", SITUACAO_STYLES[situacao])}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
        ERP: {situacao}
      </Badge>
      {total > 0 && (
        <span className="text-[10px] text-muted-foreground">
          {finalizadas}/{total} ativ.
        </span>
      )}
    </div>
  );
}