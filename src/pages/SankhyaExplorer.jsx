import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Play, AlertCircle, Database, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── SQL builders ──────────────────────────────────────────────────────────────
function buildSqlProcesso({ referencia, limit }) {
  const ref = referencia?.trim();
  const where = ref ? `WHERE PR.REFERENCIA = '${ref.replace(/'/g, "''")}'` : "";
  const n = Number(limit) || 100;
  return `SELECT TOP ${n} P.CODPROC, P.DESCRPROC, P.CODPROD, PR.DESCRPROD, PR.REFERENCIA, P.VERSAO, P.ATIVO, O.CODOPE, O.DESCROPE, O.SEQUENCIA
FROM TSIPRG P
INNER JOIN TGFPRO PR ON PR.CODPROD = P.CODPROD
LEFT JOIN TSIOPE O ON O.CODPROC = P.CODPROC
${where}
ORDER BY P.CODPROC, O.SEQUENCIA`;
}

function buildSqlComposicao({ referencia, codproc, limit }) {
  const ref = referencia?.trim();
  const proc = codproc?.trim();
  const conds = [];
  if (ref) conds.push(`PR.REFERENCIA = '${ref.replace(/'/g, "''")}'`);
  if (proc) conds.push(`E.CODPROC = ${Number(proc)}`);
  const where = conds.length > 0 ? `AND ${conds.join(" AND ")}` : "";
  const n = Number(limit) || 100;
  return `SELECT TOP ${n} E.CODPROD, PR.REFERENCIA, PR.DESCRPROD, E.CODPRODCOMP, PC.DESCRPROD AS DESCR_COMP, PC.REFERENCIA AS REF_COMP, E.QTDNEC, E.UNIDADE, E.CODPROC, E.CODOPE
FROM TGFECP E
INNER JOIN TGFPRO PR ON PR.CODPROD = E.CODPROD
INNER JOIN TGFPRO PC ON PC.CODPROD = E.CODPRODCOMP
WHERE 1=1 ${where}
ORDER BY E.CODPROD, E.CODOPE, E.CODPRODCOMP`;
}

function buildSqlPedidos({ codtipoper, dtinicio, dtfim, limit }) {
  const conds = [];
  if (codtipoper?.trim()) conds.push(`C.CODTIPOPER = ${Number(codtipoper)}`);
  if (dtinicio) conds.push(`C.DTNEG >= '${dtinicio}'`);
  if (dtfim) conds.push(`C.DTNEG <= '${dtfim}'`);
  const where = conds.length > 0 ? `AND ${conds.join(" AND ")}` : "";
  const n = Number(limit) || 100;
  return `SELECT TOP ${n} C.NUNOTA, C.NUMNOTA, C.CODTIPOPER, C.DTNEG, C.DTENTREGA, P.NOMEPARC AS CLIENTE, C.VLRNOTA, C.STATUSNOTA, C.CODVEND, C.OBSERVACAO
FROM TGFCAB C
INNER JOIN TGFPAR P ON P.CODPARC = C.CODPARC
WHERE 1=1 ${where}
ORDER BY C.DTNEG DESC`;
}

const SQL_PRESETS = [
  { label: "Ver roteiros", sql: "SELECT TOP 100 P.CODPROC, P.DESCRPROC, PR.REFERENCIA, PR.DESCRPROD, P.VERSAO, P.ATIVO\nFROM TSIPRG P\nINNER JOIN TGFPRO PR ON PR.CODPROD = P.CODPROD\nORDER BY P.CODPROC" },
  { label: "Ver etapas", sql: "SELECT TOP 200 O.CODPROC, O.CODOPE, O.DESCROPE, O.SEQUENCIA\nFROM TSIOPE O\nORDER BY O.CODPROC, O.SEQUENCIA" },
  { label: "Ver produtos", sql: "SELECT TOP 100 CODPROD, REFERENCIA, DESCRPROD, ATIVO\nFROM TGFPRO\nWHERE ATIVO = 'S'\nORDER BY REFERENCIA" },
  { label: "Listar tabelas", sql: "SELECT TOP 100 NOMETABELA, DESCRICAO\nFROM TGFTAB\nORDER BY NOMETABELA" },
];

// ── Results Table ─────────────────────────────────────────────────────────────
function ResultsTable({ columns, data, total, loading, error }) {
  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" /> Executando query...
    </div>
  );
  if (error) return (
    <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
    </div>
  );
  if (!columns) return (
    <div className="py-16 text-center text-muted-foreground text-sm">Execute uma consulta para ver os resultados</div>
  );
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">{total} registro(s)</Badge>
      </div>
      <div className="overflow-auto max-h-[520px] rounded-lg border bg-card">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10">
            <tr>
              {columns.map(col => (
                <th key={col} className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-r last:border-r-0 uppercase tracking-wide">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-8 text-muted-foreground">Nenhum registro retornado</td></tr>
            ) : data.map((row, i) => (
              <tr key={i} className={cn("border-b hover:bg-muted/40 transition-colors", i % 2 === 0 ? "" : "bg-muted/20")}>
                {columns.map(col => (
                  <td key={col} className="px-3 py-1.5 border-r last:border-r-0 max-w-[280px] truncate" title={row[col]}>
                    {row[col] || <span className="text-muted-foreground/50">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SankhyaExplorer() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tab: Processo
  const [procRef, setProcRef] = useState("");
  const [procLimit, setProcLimit] = useState("100");

  // Tab: Composição
  const [compRef, setCompRef] = useState("");
  const [compProc, setCompProc] = useState("");
  const [compLimit, setCompLimit] = useState("100");

  // Tab: Pedidos
  const [pedTop, setPedTop] = useState("");
  const [pedDtInicio, setPedDtInicio] = useState("");
  const [pedDtFim, setPedDtFim] = useState("");
  const [pedLimit, setPedLimit] = useState("100");

  // Tab: SQL Livre
  const [freeSQL, setFreeSQL] = useState("");

  const runQuery = async (sql) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke("sankhyaExplorer", { sql });
      setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Database className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Explorador Sankhya</h1>
          <p className="text-sm text-muted-foreground">Consultas interativas ao banco de dados do Sankhya ERP</p>
        </div>
      </div>

      <Tabs defaultValue="processo" className="space-y-4">
        <TabsList className="h-9">
          <TabsTrigger value="processo" className="text-xs">Processo Produtivo</TabsTrigger>
          <TabsTrigger value="composicao" className="text-xs">Composição</TabsTrigger>
          <TabsTrigger value="pedidos" className="text-xs">Pedidos</TabsTrigger>
          <TabsTrigger value="livre" className="text-xs">SQL Livre</TabsTrigger>
        </TabsList>

        {/* ── Aba: Processo Produtivo ── */}
        <TabsContent value="processo" className="space-y-3">
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Consulta roteiros (TSIPRG) e etapas (TSIOPE) do processo produtivo.</p>
            <div className="flex flex-wrap gap-2">
              <div className="flex-1 min-w-40 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Referência do produto (ex: LUS-001)" className="pl-8 h-8 text-xs"
                  value={procRef} onChange={e => setProcRef(e.target.value)} />
              </div>
              <div className="w-28">
                <Input type="number" placeholder="Limite" className="h-8 text-xs"
                  value={procLimit} onChange={e => setProcLimit(e.target.value)} />
              </div>
              <Button size="sm" className="h-8 gap-1.5" onClick={() => runQuery(buildSqlProcesso({ referencia: procRef, limit: procLimit }))}>
                <Play className="w-3.5 h-3.5" /> Consultar
              </Button>
            </div>
          </div>
          <ResultsTable {...(result || {})} loading={loading} error={error} />
        </TabsContent>

        {/* ── Aba: Composição ── */}
        <TabsContent value="composicao" className="space-y-3">
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Consulta matérias-primas por produto (TGFECP).</p>
            <div className="flex flex-wrap gap-2">
              <div className="flex-1 min-w-40 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Referência do produto" className="pl-8 h-8 text-xs"
                  value={compRef} onChange={e => setCompRef(e.target.value)} />
              </div>
              <Input placeholder="Cód. processo (CODPROC)" className="h-8 text-xs w-44"
                value={compProc} onChange={e => setCompProc(e.target.value)} />
              <Input type="number" placeholder="Limite" className="h-8 text-xs w-24"
                value={compLimit} onChange={e => setCompLimit(e.target.value)} />
              <Button size="sm" className="h-8 gap-1.5"
                onClick={() => runQuery(buildSqlComposicao({ referencia: compRef, codproc: compProc, limit: compLimit }))}>
                <Play className="w-3.5 h-3.5" /> Consultar
              </Button>
            </div>
          </div>
          <ResultsTable {...(result || {})} loading={loading} error={error} />
        </TabsContent>

        {/* ── Aba: Pedidos ── */}
        <TabsContent value="pedidos" className="space-y-3">
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Consulta cabeçalho de notas (TGFCAB) com dados do parceiro.</p>
            <div className="flex flex-wrap gap-2 items-center">
              <Input placeholder="Top (CODTIPOPER)" className="h-8 text-xs w-40"
                value={pedTop} onChange={e => setPedTop(e.target.value)} />
              <div className="flex items-center gap-1">
                <label className="text-[11px] text-muted-foreground whitespace-nowrap">De:</label>
                <Input type="date" className="h-8 text-xs w-36"
                  value={pedDtInicio} onChange={e => setPedDtInicio(e.target.value)} />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-[11px] text-muted-foreground whitespace-nowrap">Até:</label>
                <Input type="date" className="h-8 text-xs w-36"
                  value={pedDtFim} onChange={e => setPedDtFim(e.target.value)} />
              </div>
              <Input type="number" placeholder="Limite" className="h-8 text-xs w-24"
                value={pedLimit} onChange={e => setPedLimit(e.target.value)} />
              <Button size="sm" className="h-8 gap-1.5"
                onClick={() => runQuery(buildSqlPedidos({ codtipoper: pedTop, dtinicio: pedDtInicio, dtfim: pedDtFim, limit: pedLimit }))}>
                <Play className="w-3.5 h-3.5" /> Consultar
              </Button>
            </div>
          </div>
          <ResultsTable {...(result || {})} loading={loading} error={error} />
        </TabsContent>

        {/* ── Aba: SQL Livre ── */}
        <TabsContent value="livre" className="space-y-3">
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Execute qualquer SQL de leitura diretamente no Sankhya.</p>
            <div className="flex flex-wrap gap-1.5">
              {SQL_PRESETS.map(p => (
                <Button key={p.label} variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setFreeSQL(p.sql)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <Textarea
              className="font-mono text-xs min-h-[140px] resize-y"
              placeholder="SELECT TOP 50 CODPROD, REFERENCIA, DESCRPROD FROM TGFPRO ORDER BY REFERENCIA"
              value={freeSQL}
              onChange={e => setFreeSQL(e.target.value)}
            />
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" disabled={!freeSQL.trim() || loading}
                onClick={() => runQuery(freeSQL.trim())}>
                <Play className="w-3.5 h-3.5" /> Executar SQL
              </Button>
            </div>
          </div>
          <ResultsTable {...(result || {})} loading={loading} error={error} />
        </TabsContent>
      </Tabs>
    </div>
  );
}