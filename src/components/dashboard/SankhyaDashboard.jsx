import React from "react";
import { useSankhyaDashboard } from "@/hooks/useSankhyaDashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, Clock, Play, CheckCircle2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

function StatCard({ icon: Icon, label, value, color = "" }) {
  return (
    <div className={cn("bg-card rounded-xl border p-4 flex items-center gap-3", color)}>
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value ?? "—"}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

const SITUACAO_BADGE = {
  "Aguardando aceite": "bg-amber-100 text-amber-700 border-amber-200",
  "Em andamento": "bg-blue-100 text-blue-700 border-blue-200",
  "Finalizada": "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function SankhyaDashboard() {
  const { data, loading, error, refetch } = useSankhyaDashboard();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Sankhya ERP</h2>
          <p className="text-xs text-muted-foreground">OPs ativas sincronizadas</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refetch}
          disabled={loading}
          className="gap-1.5"
        >
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

      {/* Cards de totais */}
      {data?.dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="OPs Ativas" value={data.dashboard.totalOps} icon={Activity} />
          <StatCard label="Aguardando Aceite" value={data.dashboard.aguardandoAceite} icon={Clock} />
          <StatCard label="Em Andamento" value={data.dashboard.emAndamento} icon={Play} />
          <StatCard label="Finalizadas" value={data.dashboard.finalizada} icon={CheckCircle2} />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-muted/40 rounded-xl border h-20 animate-pulse" />
          ))}
        </div>
      )}

      {/* Tabela de OPs */}
      {data?.ops && (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <p className="text-sm font-semibold">OPs Ativas</p>
            <Badge variant="secondary" className="text-xs">{data.ops.length} atividades</Badge>
          </div>

          {data.ops.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma OP ativa encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Pedido</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">IDIPROC</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Produto</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Referência</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Situação</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Início</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ops.slice(0, 50).map((op, idx) => (
                    <tr
                      key={`${op.IDIPROC}-${op.IDIATV}-${idx}`}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-3 py-2 font-mono font-bold">{op.NUMPEDIDO ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{op.IDIPROC}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={op.DESCRPROD}>
                        {op.DESCRPROD ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{op.REFERENCIA ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] py-0", SITUACAO_BADGE[op.SITUACAO_ATIV] || "bg-muted text-muted-foreground")}
                        >
                          {op.SITUACAO_ATIV ?? "—"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {op.DHINICIO ? new Date(op.DHINICIO).toLocaleDateString("pt-BR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.ops.length > 50 && (
                <p className="text-center text-xs text-muted-foreground py-2 border-t">
                  Mostrando 50 de {data.ops.length} atividades
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}