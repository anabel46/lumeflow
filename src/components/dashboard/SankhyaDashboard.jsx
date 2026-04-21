import React, { useState } from "react";
import { useSankhyaData } from "@/hooks/useSankhyaData";
import SankhyaOpsPanel from "@/components/sankhya/SankhyaOpsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, Clock, Play, CheckCircle2, Activity, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SITUACAO_COLORS = {
  "Aguardando aceite": "bg-amber-100 text-amber-700 border-amber-200",
  "Em andamento": "bg-blue-100 text-blue-700 border-blue-200",
  "Finalizada": "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function AtividadeProgress({ atividades }) {
  if (!atividades || atividades.length === 0) return null;
  const total = atividades.length;
  const finalizadas = atividades.filter(a => a.situacao === "Finalizada").length;
  const emAndamento = atividades.filter(a => a.situacao === "Em andamento").length;
  const pct = Math.round((finalizadas / total) * 100);

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{finalizadas}/{total} atividades concluídas</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {emAndamento > 0 && (
        <div className="flex gap-1 flex-wrap mt-1">
          {atividades.map((a) => (
            <Badge
              key={a.id}
              variant="outline"
              className={cn("text-[10px] py-0 px-1.5", SITUACAO_COLORS[a.situacao] || "bg-muted text-muted-foreground")}
            >
              {a.id} · {a.situacao}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function OPCard({ op }) {
  const produto = op.produtos?.[0];
  const totalAtiv = op.atividades?.length || 0;
  const finalizadas = op.atividades?.filter(a => a.situacao === "Finalizada").length || 0;
  const statusAtual = op.atividades?.find(a => a.situacao === "Em andamento")?.situacao
    || op.atividades?.find(a => a.situacao === "Aguardando aceite")?.situacao
    || (finalizadas === totalAtiv && totalAtiv > 0 ? "Finalizada" : "—");

  return (
    <div className="bg-muted/30 rounded-lg border p-3 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold font-mono">OP #{op.numeroOp}</p>
          {produto && (
            <p className="text-xs text-foreground font-medium mt-0.5 line-clamp-2">
              {produto.descricao || "—"}
              {produto.referencia ? (
                <span className="text-muted-foreground ml-1 font-normal font-mono">({produto.referencia})</span>
              ) : null}
            </p>
          )}
        </div>
        <Badge
          variant="outline"
          className={cn("text-[10px] shrink-0 py-0", SITUACAO_COLORS[statusAtual] || "bg-muted text-muted-foreground")}
        >
          {statusAtual}
        </Badge>
      </div>
      <AtividadeProgress atividades={op.atividades} />
    </div>
  );
}

function PedidoCard({ numeroPedido, ops, getOpsByPedido }) {
  const [expanded, setExpanded] = useState(false);
  const opList = Object.values(ops);
  const totalOps = opList.length;

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="text-sm font-bold font-mono">Pedido #{numeroPedido}</span>
          <Badge variant="secondary" className="text-[10px]">{totalOps} {totalOps === 1 ? "OP" : "OPs"}</Badge>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <SankhyaOpsPanel ops={getOpsByPedido(numeroPedido)} />
        </div>
      )}
    </div>
  );
}

export default function SankhyaDashboard() {
  const { data, loading, error, refetch, getOpsByPedido } = useSankhyaData();

  const pedidos = data?.pedidos ? Object.entries(data.pedidos) : [];
  const est = data?.estatisticas;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">OPs ativas sincronizadas do Sankhya ERP</p>
        <Button variant="outline" size="sm" onClick={refetch} disabled={loading} className="gap-1.5">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          {loading ? "Carregando..." : "Atualizar"}
        </Button>
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/20 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Erro na integração Sankhya</p>
            <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Estatísticas */}
      {est && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "OPs Ativas", value: est.totalOps, icon: Activity },
            { label: "Aguardando Aceite", value: est.aguardando, icon: Clock },
            { label: "Em Andamento", value: est.emAndamento, icon: Play },
            { label: "Finalizadas", value: est.finalizadas, icon: CheckCircle2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card rounded-xl border p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{value ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-muted/40 rounded-xl border h-20 animate-pulse" />
            ))}
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-muted/40 rounded-xl border h-24 animate-pulse" />
          ))}
        </div>
      )}

      {/* Pedidos agrupados */}
      {!loading && pedidos.length === 0 && !error && data && (
        <div className="text-center text-sm text-muted-foreground py-8">
          Nenhuma OP ativa encontrada no Sankhya.
        </div>
      )}

      {pedidos.length > 0 && (
        <div className="space-y-3">
          {pedidos.map(([numeroPedido, ops]) => (
            <PedidoCard key={numeroPedido} numeroPedido={numeroPedido} ops={ops} getOpsByPedido={getOpsByPedido} />
          ))}
        </div>
      )}
    </div>
  );
}