import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, Ban, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcOPProgress(op) {
  const atividades = op.atividades || [];
  if (!atividades.length) return op.situacaoGeral === "F" ? 100 : 0;
  const finalizadas = atividades.filter(a => a.situacao === "Finalizada").length;
  return Math.round((finalizadas / atividades.length) * 100);
}

function calcPedidoProgress(opsMap) {
  const ops = Object.values(opsMap);
  if (!ops.length) return 0;
  const total = ops.reduce((sum, op) => sum + calcOPProgress(op), 0);
  return Math.round(total / ops.length);
}

function getStatusLabel(situacao) {
  if (situacao === "F") return "Finalizado";
  if (situacao === "A") return "Em andamento";
  return "Aguardando";
}

// ── Circular Progress ─────────────────────────────────────────────────────────
function CircularProgress({ pct, finalizadas, total }) {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  const color = pct === 100 ? "#22c55e" : pct > 0 ? "#eab308" : "#d1d5db";

  return (
    <div className="relative w-8 h-8 shrink-0">
      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="16" cy="16" r={radius} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground">
        {pct}%
      </span>
    </div>
  );
}

// ── Activity Tag ──────────────────────────────────────────────────────────────
function ActivityTag({ atividade }) {
  const isFinalizada = atividade.situacao === "Finalizada";
  const isEmAndamento = atividade.situacao === "Em andamento";

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
      isFinalizada
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : isEmAndamento
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : "bg-white text-gray-600 border-gray-200"
    )}>
      {isFinalizada && <span className="mr-0.5 text-emerald-500">✓</span>}
      {atividade.descricao}
    </span>
  );
}

// ── OP Row ────────────────────────────────────────────────────────────────────
function OPRow({ op, selected, onToggle, onBlock, onDelete }) {
  const pct = calcOPProgress(op);
  const produto = op.produtos?.[0];
  const statusLabel = getStatusLabel(op.situacaoGeral);

  // Deduplica atividades por descricao (pode ter duplicatas do Sankhya)
  const uniqueAtividades = Array.from(
    new Map((op.atividades || []).map(a => [a.descricao, a])).values()
  );

  return (
    <div className="pl-4 pr-3 py-3 border-t border-border/40 bg-white hover:bg-muted/20 transition-colors">
      <div className="flex items-start gap-2.5">
        {/* Checkbox */}
        <div className="mt-0.5 shrink-0">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggle(op.numeroOp)}
            className="w-3.5 h-3.5"
            disabled={op.situacaoGeral === "F"}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Top line: OP badge + referencia + descricao */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-[11px] font-mono font-bold text-foreground shrink-0">
              OP-{op.numeroOp}
            </span>
            {produto?.referencia && (
              <span className="text-sm font-bold text-blue-500 shrink-0">{produto.referencia}</span>
            )}
            {produto?.descricao && (
              <span className="text-xs text-muted-foreground truncate">{produto.descricao}</span>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  op.situacaoGeral === "F" ? "bg-emerald-500" : pct > 0 ? "bg-primary" : "bg-gray-300"
                )}
                style={{ width: `${op.situacaoGeral === "F" ? 100 : pct}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">
              {op.situacaoGeral === "F" ? 100 : pct}%
            </span>
          </div>

          {/* Activity tags */}
          {uniqueAtividades.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {uniqueAtividades.map((a, i) => (
                <ActivityTag key={i} atividade={a} />
              ))}
            </div>
          )}
        </div>

        {/* Right side: status badge + actions */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] py-0 font-medium",
              op.situacaoGeral === "F"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : op.situacaoGeral === "A"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-gray-100 text-gray-500 border-gray-200"
            )}
          >
            {statusLabel}
          </Badge>
          <div className="flex gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
              onClick={() => onBlock?.(op)}
              title="Bloquear"
            >
              <Ban className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete?.(op)}
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pedido Card ───────────────────────────────────────────────────────────────
function PedidoCard({ numeroPedido, opsMap, selectedIds, onToggleOP, onToggleAll, onBlock, onDelete }) {
  const [expanded, setExpanded] = useState(true);

  const ops = Object.values(opsMap);
  const total = ops.length;
  const finalizadas = ops.filter(o => o.situacaoGeral === "F").length;
  const pct = calcPedidoProgress(opsMap);

  const selectableOps = ops.filter(o => o.situacaoGeral !== "F");
  const selectableIds = selectableOps.map(o => o.numeroOp);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));
  const someSelected = selectableIds.some(id => selectedIds.has(id));

  return (
    <div className="bg-white rounded-xl border border-border/60 overflow-hidden shadow-sm">
      {/* Pedido header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-muted/30">
        {/* Checkbox */}
        <div onClick={e => e.stopPropagation()} className="shrink-0">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => onToggleAll(selectableIds, allSelected)}
            disabled={selectableIds.length === 0}
            className="w-4 h-4"
          />
        </div>

        {/* Title + meta */}
        <button
          className="flex flex-1 items-center gap-3 text-left min-w-0"
          onClick={() => setExpanded(e => !e)}
        >
          <span className="font-bold text-sm">Pedido #{numeroPedido}</span>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {/* OP count badge */}
            <Badge variant="outline" className="text-[10px] font-semibold">
              {finalizadas}/{total} OPs
            </Badge>

            {/* Circular progress */}
            <CircularProgress pct={pct} finalizadas={finalizadas} total={total} />

            {/* Chevron */}
            {expanded
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>
      </div>

      {/* OP rows */}
      {expanded && ops.map(op => (
        <OPRow
          key={op.numeroOp}
          op={op}
          selected={selectedIds.has(op.numeroOp)}
          onToggle={onToggleOP}
          onBlock={onBlock}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
/**
 * @param {object} props
 * @param {{ pedidos: Record<string, Record<string, object>>, estatisticas: object }} props.data
 * @param {Set<string|number>} props.selectedIds
 * @param {(id) => void} props.onToggleOP
 * @param {(ids, allSelected) => void} props.onToggleAll
 * @param {(op) => void} [props.onBlock]
 * @param {(op) => void} [props.onDelete]
 */
export default function ProductionOrderList({
  data,
  selectedIds = new Set(),
  onToggleOP,
  onToggleAll,
  onBlock,
  onDelete,
}) {
  if (!data?.pedidos) return null;

  const pedidoEntries = Object.entries(data.pedidos);

  if (pedidoEntries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhuma ordem de produção encontrada.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pedidoEntries.map(([numeroPedido, opsMap]) => (
        <PedidoCard
          key={numeroPedido}
          numeroPedido={numeroPedido}
          opsMap={opsMap}
          selectedIds={selectedIds}
          onToggleOP={onToggleOP}
          onToggleAll={onToggleAll}
          onBlock={onBlock}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}