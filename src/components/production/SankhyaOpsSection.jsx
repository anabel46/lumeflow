import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, ChevronDown, Activity, Clock, Play, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useEffect } from "react";

const SITUACAO_BADGE = {
  "Aguardando aceite": "bg-amber-100 text-amber-700 border-amber-200",
  "Em andamento":      "bg-blue-100 text-blue-700 border-blue-200",
  "Finalizada":        "bg-emerald-100 text-emerald-700 border-emerald-200",
};

// Agrupa atividades por NUMPEDIDO → IDIPROC
function groupOps(ops) {
  const byPedido = {};
  for (const op of ops) {
    const ped = op.NUMPEDIDO ?? "Sem pedido";
    if (!byPedido[ped]) byPedido[ped] = {};
    const proc = op.IDIPROC;
    if (!byPedido[ped][proc]) {
      byPedido[ped][proc] = {
        IDIPROC: proc,
        DESCRPROD: op.DESCRPROD,
        REFERENCIA: op.REFERENCIA,
        DHINICIO: op.DHINICIO,
        atividades: [],
      };
    }
    byPedido[ped][proc].atividades.push(op);
  }
  return byPedido;
}

function ActivityProgress({ atividades }) {
  const total = atividades.length;
  const done  = atividades.filter(a => a.SITUACAO_ATIV === "Finalizada").length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const current = atividades.find(a => a.SITUACAO_ATIV === "Em andamento");

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0 w-8 text-right">{pct}%</span>
        <span className="text-[10px] text-muted-foreground shrink-0">{done}/{total}</span>
      </div>
      {/* Chips de atividades */}
      <div className="flex flex-wrap gap-1">
        {atividades.map((atv, i) => (
          <span
            key={i}
            title={`${atv.DESCRATIV ?? `Ativ. ${i+1}`} — ${atv.SITUACAO_ATIV}`}
            className={cn(
              "text-[9px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap",
              atv.SITUACAO_ATIV === "Finalizada"      ? "bg-emerald-100 text-emerald-700" :
              atv.SITUACAO_ATIV === "Em andamento"    ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300" :
                                                        "bg-muted text-muted-foreground/70"
            )}
          >
            {atv.DESCRATIV ? atv.DESCRATIV.substring(0, 12) : `Atv ${i+1}`}
          </span>
        ))}
      </div>
      {current && (
        <p className="text-[10px] text-blue-600 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
          Atual: <strong>{current.DESCRATIV ?? "Em andamento"}</strong>
        </p>
      )}
    </div>
  );
}

function OPCard({ proc }) {
  const situacoes = proc.atividades.map(a => a.SITUACAO_ATIV);
  const overall =
    situacoes.every(s => s === "Finalizada") ? "Finalizada" :
    situacoes.some(s => s === "Em andamento") ? "Em andamento" :
    "Aguardando aceite";

  return (
    <div className="bg-card border border-border/60 rounded-lg p-3 space-y-2 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded font-bold">
            OP {proc.IDIPROC}
          </span>
          <p className="text-sm font-semibold mt-1 leading-tight truncate" title={proc.DESCRPROD}>
            {proc.DESCRPROD ?? "—"}
          </p>
          {proc.REFERENCIA && (
            <p className="text-[10px] text-muted-foreground font-mono">{proc.REFERENCIA}</p>
          )}
        </div>
        <Badge
          variant="outline"
          className={cn("text-[10px] py-0 shrink-0", SITUACAO_BADGE[overall] ?? "bg-muted text-muted-foreground")}
        >
          {overall}
        </Badge>
      </div>
      <ActivityProgress atividades={proc.atividades} />
      {proc.DHINICIO && (
        <p className="text-[10px] text-muted-foreground">
          Início: {new Date(proc.DHINICIO).toLocaleDateString("pt-BR")}
        </p>
      )}
    </div>
  );
}

function PedidoGroup({ pedido, procs }) {
  const [expanded, setExpanded] = useState(true);
  const procList = Object.values(procs);
  const total = procList.length;
  const done  = procList.filter(p => p.atividades.every(a => a.SITUACAO_ATIV === "Finalizada")).length;

  return (
    <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Pedido #{pedido}</p>
          <p className="text-[11px] text-muted-foreground">{total} OP(s) · {done} finalizada(s)</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-xs font-semibold">{done}/{total}</p>
          </div>
          <div className="relative w-8 h-8">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
              <circle cx="16" cy="16" r="12" fill="none"
                stroke={done === total ? "hsl(142,71%,45%)" : "hsl(221,83%,53%)"}
                strokeWidth="4"
                strokeDasharray={`${(total > 0 ? done / total : 0) * 75.4} 75.4`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
              {total > 0 ? Math.round((done / total) * 100) : 0}%
            </span>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {procList.map(proc => (
            <OPCard key={proc.IDIPROC} proc={proc} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SankhyaOpsSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("getDashboard");
      setData(res.data ?? res);
    } catch (err) {
      setError(err.message || "Erro ao buscar dados do Sankhya");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const grouped = useMemo(() => data?.ops ? groupOps(data.ops) : null, [data]);

  const stats = data?.dashboard;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            OPs Sankhya ERP
          </h2>
          <p className="text-xs text-muted-foreground">Pedidos e ordens de produção sincronizados</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5">
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

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-muted/40 rounded-xl border h-24 animate-pulse" />
          ))}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "OPs Ativas",         value: stats.totalOps,        icon: Activity,     color: "text-primary" },
            { label: "Aguardando Aceite",  value: stats.aguardandoAceite, icon: Clock,        color: "text-amber-600" },
            { label: "Em Andamento",       value: stats.emAndamento,      icon: Play,         color: "text-blue-600" },
            { label: "Finalizadas",        value: stats.finalizada,       icon: CheckCircle2, color: "text-emerald-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card rounded-xl border p-3 flex items-center gap-2.5">
              <Icon className={cn("w-5 h-5 shrink-0", color)} />
              <div>
                <p className="text-xl font-bold leading-none">{value ?? "—"}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pedidos agrupados */}
      {grouped && (
        Object.keys(grouped).length === 0 ? (
          <div className="bg-card rounded-xl border p-8 text-center text-sm text-muted-foreground">
            Nenhuma OP ativa encontrada no Sankhya.
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([pedido, procs]) => (
              <PedidoGroup key={pedido} pedido={pedido} procs={procs} />
            ))}
          </div>
        )
      )}
    </div>
  );
}