import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SECTORS } from "@/lib/constants";

const QC_CHECK_ITEMS = [
  { key: "visual_appearance", label: "Aparência Visual" },
  { key: "dimensions", label: "Dimensões" },
  { key: "finish_quality", label: "Qualidade do Acabamento" },
  { key: "paint_quality", label: "Qualidade da Pintura" },
  { key: "electrical_test", label: "Teste Elétrico" },
  { key: "assembly_integrity", label: "Integridade da Montagem" },
  { key: "packaging", label: "Embalagem" },
];
import {
  Search, CheckCircle2, AlertTriangle, Play, Clock,
  Eye, Store, MapPin, MessageSquare, Package, ArrowRight,
  Wrench, ChevronRight, ChevronDown, ExternalLink, Truck, Calendar
} from "lucide-react";
import PODetailModal from "@/components/production/PODetailModal";
import StockDeductionAlert from "@/components/production/StockDeductionAlert";
import ReturnIssueDialog from "@/components/production/ReturnIssueDialog";
import { format, formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SECTOR_LABELS, LOCATION_TO_MESA, PURCHASE_LOCATIONS } from "@/lib/constants";
import { useNotifications } from "@/lib/NotificationContext";

// Setores que usam visualização individual (por OP)
const INDIVIDUAL_SECTORS = ["estamparia", "tornearia"];

// Setores de montagem: visualização kanban por pedido → ambiente
const ASSEMBLY_SECTORS = ["montagem_decorativa", "montagem_eletrica", "montagem_perfil", "montagem_embutidos"];

// Mesas de loja
const MESA_SECTORS = ["mesa_barra", "mesa_ipanema", "mesa_sao_gabriel", "mesa_vila_madalena", "mesa_fabrica"];

const SECTOR_STATUS_COLORS = {
  aguardando: "border-l-amber-400",
  em_producao: "border-l-blue-500",
  concluido: "border-l-emerald-500",
};

// ─── Card individual de OP (estamparia / tornearia / mesas) ───────────────────
function OrderCard({ po, onStart, onComplete, onDetail }) {
  const isOverdue = po.delivery_deadline && new Date(po.delivery_deadline) < new Date() && po.sector_status !== "concluido";
  const sectorStatus = po.sector_status || "aguardando";

  return (
    <div className={cn(
      "bg-card rounded-xl border-l-4 border border-border/60 p-3.5 hover:shadow-md transition-all",
      isOverdue ? "border-l-red-500 bg-red-50/10" : SECTOR_STATUS_COLORS[sectorStatus]
    )}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">{po.unique_number}</span>
          {po.is_intermediate && (
            <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700 gap-0.5">
              <Package className="w-2.5 h-2.5" />Inter.
            </Badge>
          )}
          {isOverdue && (
            <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 gap-0.5">
              <AlertTriangle className="w-2.5 h-2.5" />Atrasado
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onDetail(po)} className="h-7 w-7 p-0">
            <Eye className="w-3.5 h-3.5" />
          </Button>
          {sectorStatus === "aguardando" && (
            <Button size="sm" variant="outline" onClick={() => onStart(po)} className="h-7 px-2 gap-1 text-xs">
              <Play className="w-3 h-3" /> Iniciar
            </Button>
          )}
          {sectorStatus === "em_producao" && (
            <Button size="sm" onClick={() => onComplete(po)} className="h-7 px-2 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="w-3 h-3" /> Concluir
            </Button>
          )}
        </div>
      </div>

      <p className="font-semibold text-sm leading-tight">{po.product_name}</p>
      {po.reference && <p className="text-[11px] text-muted-foreground font-mono">{po.reference}</p>}

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
        <Link to={`/pedidos/${po.order_id}`} className="hover:text-primary transition-colors">
          Ped. <strong className="text-foreground">#{po.order_number}</strong>
        </Link>
        <span>Qtd: <strong className="text-foreground">{po.quantity}</strong></span>
        {po.color && <span>Cor: <strong className="text-foreground">{po.color}</strong></span>}
        {po.environment && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{po.environment}</span>}
        {po.delivery_deadline && (
          <span className={cn(isOverdue ? "text-red-500 font-semibold" : "")}>
            {format(new Date(po.delivery_deadline), "dd/MM/yy")}
          </span>
        )}
      </div>

      {po.observations && (
        <div className="mt-2 flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
          <MessageSquare className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-snug line-clamp-2">{po.observations}</p>
        </div>
      )}

      {po.sector_started_at && sectorStatus === "em_producao" && (
        <div className="flex items-center gap-1 mt-2 text-xs text-blue-600 font-medium">
          <Clock className="w-3 h-3" />
          {format(new Date(po.sector_started_at), "HH:mm")} · {formatDistanceStrict(new Date(po.sector_started_at), new Date(), { locale: ptBR })}
        </div>
      )}

      {po.production_sequence?.length > 0 && (
        <div className="flex items-center gap-0.5 mt-2 overflow-x-auto pb-0.5 no-scrollbar">
          {po.production_sequence.map((s, i) => {
            const isDone = i < (po.current_step_index ?? 0);
            const isCurrent = s === po.current_sector;
            return (
              <React.Fragment key={i}>
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap",
                  isDone ? "bg-emerald-100 text-emerald-700" :
                  isCurrent ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300" :
                  "bg-muted text-muted-foreground/60"
                )}>
                  {SECTOR_LABELS[s]?.substring(0, 10) || s}
                </span>
                {i < po.production_sequence.length - 1 && (
                  <ChevronRight className="w-2 h-2 text-muted-foreground/30 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Mini row de OP dentro do card de pedido (montagem) ──────────────────────
function PORow({ po, onStart, onComplete, onDetail }) {
  const isOverdue = po.delivery_deadline && new Date(po.delivery_deadline) < new Date() && po.sector_status !== "concluido";
  const sectorStatus = po.sector_status || "aguardando";
  const isDone = sectorStatus === "concluido";

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg px-3 py-2 border transition-all",
      isDone ? "bg-emerald-50/50 border-emerald-100 opacity-75" :
      sectorStatus === "em_producao" ? "bg-blue-50/50 border-blue-100" :
      "bg-muted/30 border-border/40",
      isOverdue && !isDone && "bg-red-50/30 border-red-100"
    )}>
      <div className={cn("w-2 h-2 rounded-full shrink-0",
        isDone ? "bg-emerald-500" :
        sectorStatus === "em_producao" ? "bg-blue-500 animate-pulse" :
        "bg-amber-400"
      )} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[11px] font-bold text-muted-foreground">{po.unique_number}</span>
          <span className="text-xs font-medium truncate">{po.product_name}</span>
          {po.is_intermediate && (
            <Badge variant="outline" className="text-[9px] border-purple-300 text-purple-600 py-0 px-1">Inter.</Badge>
          )}
          {isOverdue && !isDone && (
            <Badge variant="outline" className="text-[9px] border-red-300 text-red-600 py-0 px-1 gap-0.5">
              <AlertTriangle className="w-2.5 h-2.5" />Atrasado
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground mt-0.5">
          <span>Qtd: <strong className="text-foreground">{po.quantity}</strong></span>
          {po.color && <span>Cor: <strong className="text-foreground">{po.color}</strong></span>}
          {po.reference && <span className="font-mono">{po.reference}</span>}
          {po.complement && <span>{po.complement}</span>}
          {po.sector_started_at && sectorStatus === "em_producao" && (
            <span className="text-blue-600 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {formatDistanceStrict(new Date(po.sector_started_at), new Date(), { locale: ptBR })}
            </span>
          )}
        </div>
        {/* Sequência */}
        {po.production_sequence?.length > 0 && (
          <div className="flex items-center gap-0.5 mt-1 overflow-x-auto pb-0.5 no-scrollbar">
            {po.production_sequence.map((s, i) => {
              const isSectorDone = i < (po.current_step_index ?? 0);
              const isCurrent = s === po.current_sector;
              return (
                <React.Fragment key={i}>
                  <span className={cn(
                    "text-[8px] px-1 py-0.5 rounded font-medium whitespace-nowrap",
                    isSectorDone ? "bg-emerald-100 text-emerald-700" :
                    isCurrent ? "bg-blue-100 text-blue-700 ring-1 ring-blue-200" :
                    "bg-muted/60 text-muted-foreground/50"
                  )}>
                    {SECTOR_LABELS[s]?.substring(0, 8) || s}
                  </span>
                  {i < po.production_sequence.length - 1 && (
                    <ChevronRight className="w-1.5 h-1.5 text-muted-foreground/20 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => onDetail(po)} className="h-6 w-6 p-0">
          <Eye className="w-3 h-3" />
        </Button>
        {sectorStatus === "aguardando" && (
          <Button size="sm" variant="outline" onClick={() => onStart(po)} className="h-6 px-2 text-[11px] gap-0.5">
            <Play className="w-2.5 h-2.5" /> Iniciar
          </Button>
        )}
        {sectorStatus === "em_producao" && (
          <Button size="sm" onClick={() => onComplete(po)} className="h-6 px-2 text-[11px] gap-0.5 bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="w-2.5 h-2.5" /> Concluir
          </Button>
        )}
        {isDone && (
          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">✓</Badge>
        )}
      </div>
    </div>
  );
}

// ─── Card de pedido agrupado (montagem: por pedido → por ambiente) ─────────────
function AssemblyOrderCard({ orderNumber, orderId, pos, deliveryDeadline, observations, onStart, onComplete, onDetail }) {
  const [expanded, setExpanded] = useState(true);
  const now = new Date();
  const isOverdue = deliveryDeadline && new Date(deliveryDeadline) < now;

  const total = pos.length;
  const done = pos.filter(p => p.sector_status === "concluido").length;
  const inProd = pos.filter(p => p.sector_status === "em_producao").length;
  const allDone = done === total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Group POs by ambiente
  const byEnv = {};
  pos.forEach(po => {
    const env = po.environment || "Sem ambiente";
    if (!byEnv[env]) byEnv[env] = [];
    byEnv[env].push(po);
  });

  return (
    <div className={cn(
      "bg-card rounded-xl border border-border/60 overflow-hidden hover:shadow-md transition-all",
      isOverdue && !allDone && "border-red-200",
      allDone && "opacity-70"
    )}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/pedidos/${orderId}`}
              className="font-bold text-sm hover:text-primary transition-colors flex items-center gap-1"
              onClick={e => e.stopPropagation()}
            >
              Pedido #{orderNumber}
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Link>
            {isOverdue && !allDone && (
              <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 gap-0.5 py-0">
                <AlertTriangle className="w-2.5 h-2.5" />Atrasado
              </Badge>
            )}
            {allDone && (
              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 py-0">✓ Concluído</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground mt-0.5">
            {deliveryDeadline && (
              <span className={cn(isOverdue && !allDone ? "text-red-500 font-semibold" : "")}>
                Prazo: {format(new Date(deliveryDeadline), "dd/MM/yy")}
              </span>
            )}
            <span>{Object.keys(byEnv).length} ambiente(s)</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold">{done}/{total} OPs</p>
            {inProd > 0 && <p className="text-[10px] text-blue-600">{inProd} produzindo</p>}
          </div>
          <div className="relative w-8 h-8 shrink-0">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
              <circle
                cx="16" cy="16" r="12" fill="none"
                stroke={allDone ? "hsl(142,71%,45%)" : inProd > 0 ? "hsl(221,83%,53%)" : "hsl(38,92%,50%)"}
                strokeWidth="4"
                strokeDasharray={`${(pct / 100) * 75.4} 75.4`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">{pct}%</span>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {observations && (
        <div className="mx-4 mb-2 flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
          <MessageSquare className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-snug line-clamp-2">{observations}</p>
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {Object.entries(byEnv).map(([env, envPos]) => (
            <div key={env}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <MapPin className="w-3 h-3 text-primary" />
                <span className="text-xs font-semibold text-primary">{env}</span>
                <span className="text-[10px] text-muted-foreground">({envPos.length} OP)</span>
              </div>
              <div className="space-y-1.5 pl-4 border-l-2 border-primary/20">
                {envPos.map(po => (
                  <PORow key={po.id} po={po} onStart={onStart} onComplete={onComplete} onDetail={onDetail} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Ghost agrupado por pedido ────────────────────────────────────────────────
function GhostGroupCard({ orderNumber, orderId, pos, onDetail }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-muted/30 rounded-xl border border-dashed border-muted-foreground/20 overflow-hidden opacity-75">
      <button
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div>
          <p className="font-semibold text-sm text-muted-foreground">Pedido #{orderNumber}</p>
          <p className="text-[11px] text-muted-foreground/70">{pos.length} OP(s) concluída(s) neste setor</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">✓ Concluído</Badge>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {pos.map(po => (
            <div key={po.id} className="bg-muted/30 rounded-lg border border-dashed p-2.5 opacity-75 flex items-center justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] text-muted-foreground">{po.unique_number}</span>
                <p className="text-xs font-medium">{po.product_name}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onDetail(po)} className="h-6 px-1.5">
                <Eye className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Ghost card simples ───────────────────────────────────────────────────────
function GhostCard({ po, onDetail }) {
  return (
    <div className="bg-muted/30 rounded-xl border border-dashed border-muted-foreground/20 p-3 opacity-75">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded font-bold">{po.unique_number}</span>
          <p className="text-sm font-medium text-muted-foreground mt-1 leading-tight">{po.product_name}</p>
          <div className="flex gap-3 text-[11px] text-muted-foreground/70 mt-0.5">
            <span>Ped. #{po.order_number}</span>
            <span>Qtd: {po.quantity}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">✓</Badge>
          <Button variant="ghost" size="sm" onClick={() => onDetail(po)} className="h-6 px-1.5">
            <Eye className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ title, colorClass, count, children }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 bg-background py-1 z-10">
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", colorClass)} />
        <span className="font-semibold text-sm">{title}</span>
        <Badge variant="secondary" className="text-xs ml-auto">{count}</Badge>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SectorView() {
  const { sectorId } = useParams();
  const [search, setSearch] = useState("");
  const [completing, setCompleting] = useState(null);
  const [completionForm, setCompletionForm] = useState({ observations: "", changes: "", operator: "" });
  // For embalagem: next destination + QC
  const [embalagemDest, setEmbalagemDest] = useState("auto");
  const [qcForm, setQcForm] = useState({
    inspector: "",
    visual_appearance: "na", dimensions: "na", finish_quality: "na", paint_quality: "na",
    electrical_test: "na", assembly_integrity: "na", packaging: "na",
    overall_result: "aprovado", qc_observations: "",
    correction_sector: "",
  });
  const qcNeedsCorrection = qcForm.overall_result === "reprovado" || qcForm.overall_result === "retrabalho";
  const [detailPO, setDetailPO] = useState(null);
  const [stockAlert, setStockAlert] = useState(null);
  const [startingPO, setStartingPO] = useState(null);
  const [returnIssueDialog, setReturnIssueDialog] = useState(null);
  const [returnData, setReturnData] = useState(null);
  const queryClient = useQueryClient();
  const { notify } = useNotifications();

  const isIndividual = INDIVIDUAL_SECTORS.includes(sectorId);
  const isAssembly = ASSEMBLY_SECTORS.includes(sectorId);
  const isMesa = MESA_SECTORS.includes(sectorId);
  const isEmbalagem = sectorId === "embalagem";
  const sectorLabel = SECTOR_LABELS[sectorId] || sectorId;

  const { data: stockItems = [] } = useQuery({
    queryKey: ["stock-items"],
    queryFn: () => base44.entities.StockItem.list("name", 500),
  });

  const { data: productionOrders = [], isLoading } = useQuery({
    queryKey: ["sector-orders", sectorId],
    queryFn: () => base44.entities.ProductionOrder.filter({ current_sector: sectorId }),
    refetchInterval: 5000,
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => base44.entities.Order.list("-created_date", 500),
  });

  const { data: allRelevantOrders = [] } = useQuery({
    queryKey: ["sector-passed-orders", sectorId],
    queryFn: async () => {
      const logs = await base44.entities.SectorLog.filter({ sector: sectorId, action: "saida" });
      if (!logs.length) return [];
      const poIds = [...new Set(logs.map(l => l.production_order_id))];
      const results = await Promise.all(
        poIds.map(id => base44.entities.ProductionOrder.filter({ id }).then(r => r?.[0]).catch(() => null))
      );
      return results.filter(Boolean).filter(po => po.current_sector !== sectorId);
    },
    refetchInterval: 5000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["sector-orders", sectorId] });
    queryClient.invalidateQueries({ queryKey: ["sector-passed-orders", sectorId] });
    queryClient.invalidateQueries({ queryKey: ["production-orders"] });
    queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    queryClient.invalidateQueries({ queryKey: ["expedicao-orders"] });
  };

  const handleStartClick = async (po) => {
    const parentOrder = allOrders.find(o => o.id === po.order_id);
    if (parentOrder?.status === "aprovacao_pendente") {
      alert(`O pedido #${po.order_number} ainda está aguardando aprovação do gerente.`);
      return;
    }
    if ((po.current_step_index || 0) > 0) {
      setReturnIssueDialog(po);
      return;
    }
    if (stockItems.length === 0) { startMutation.mutate(po); return; }
    const product = await base44.entities.Product.filter({ id: po.product_id }).then(r => r?.[0]).catch(() => null);
    const components = product?.components || [];
    if (components.length === 0) { startMutation.mutate(po); return; }

    const deductions = components.map(comp => {
      const stockItem = stockItems.find(s => s.code === comp.reference || s.name?.toLowerCase() === comp.name?.toLowerCase());
      const needed = (comp.quantity_per_unit || 1) * (po.quantity || 1);
      const currentStock = stockItem ? (stockItem.quantity_factory || 0) : 0;
      const afterStock = currentStock - needed;
      return {
        name: comp.name, code: comp.reference || "-", unit: stockItem?.unit || "un",
        needed, currentStock, stockItemId: stockItem?.id || null,
        insufficient: currentStock < needed,
        willBeLow: stockItem && afterStock < (stockItem.minimum_stock || 0) && afterStock >= 0,
      };
    }).filter(d => d.stockItemId);

    if (deductions.length === 0) { startMutation.mutate(po); return; }
    setStartingPO(po);
    setStockAlert({ po, deductions });
  };

  const confirmStart = async () => {
    if (!startingPO || !stockAlert) return;
    for (const d of stockAlert.deductions) {
      if (!d.stockItemId) continue;
      const item = stockItems.find(s => s.id === d.stockItemId);
      if (!item) continue;
      const newQty = Math.max(0, (item.quantity_factory || 0) - d.needed);
      await base44.entities.StockItem.update(d.stockItemId, { quantity_factory: newQty });
      await base44.entities.StockMovement.create({
        stock_item_id: d.stockItemId, item_name: d.name, item_code: d.code,
        movement_type: "saida", quantity: d.needed, from_stock: "fabril",
        reason: `Produção iniciada — OP ${startingPO.unique_number}`,
        production_order_id: startingPO.id, unique_number: startingPO.unique_number,
      });
      // Marcar reserva como consumida
      const reservations = await base44.entities.StockReservation.filter({
        production_order_id: startingPO.id,
        stock_item_id: d.stockItemId,
        status: "ativa",
      });
      for (const res of reservations) {
        await base44.entities.StockReservation.update(res.id, { status: "consumida" });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    queryClient.invalidateQueries({ queryKey: ["stock-reservations"] });
    setStockAlert(null);
    startMutation.mutate(startingPO);
    setStartingPO(null);
  };

  const startMutation = useMutation({
    mutationFn: async (po) => {
      await base44.entities.SectorLog.create({
        production_order_id: po.id, unique_number: po.unique_number,
        sector: sectorId, action: "entrada",
        started_at: new Date().toISOString(), timestamp: new Date().toISOString(),
      });
      const updateData = {
        sector_started_at: new Date().toISOString(),
        status: "em_producao",
        started_at: po.started_at || new Date().toISOString(),
      };
      if (returnData) {
        updateData.return_from_sector = {
          ...returnData,
          from_sector: SECTOR_LABELS[po.production_sequence?.[po.current_step_index - 1]] || null,
        };
      }
      return base44.entities.ProductionOrder.update(po.id, updateData);
    },
    onSuccess: () => { setReturnData(null); setReturnIssueDialog(null); invalidateAll(); },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ po, observations, changes, operator, destOverride, qc }) => {
      const finishedAt = new Date().toISOString();
      const fullObs = [observations, changes ? `Alterações: ${changes}` : ""].filter(Boolean).join("\n\n");
      await base44.entities.SectorLog.create({
        production_order_id: po.id, unique_number: po.unique_number,
        sector: sectorId, action: "saida",
        observations: fullObs, operator,
        started_at: po.sector_started_at || null, finished_at: finishedAt,
        timestamp: finishedAt,
      });

      // Special logic for embalagem: QC + determine next sector
      if (isEmbalagem) {
        // Save quality check
        const { correction_sector, qc_observations, inspector, ...qcChecks } = qc || {};
        await base44.entities.QualityCheck.create({
          production_order_id: po.id,
          unique_number: po.unique_number,
          product_name: po.product_name,
          inspector: inspector || operator,
          observations: qc_observations || "",
          ...qcChecks,
        });

        // If reprovado/retrabalho, send back to correction sector
        if ((qcChecks.overall_result === "reprovado" || qcChecks.overall_result === "retrabalho") && correction_sector) {
          return base44.entities.ProductionOrder.update(po.id, {
            current_sector: correction_sector,
            sector_started_at: null,
            status: "em_producao",
          });
        }

        // Approved: determine next sector
        let nextSector = destOverride;
        if (!nextSector || nextSector === "auto") {
          const loc = po.purchase_location;
          nextSector = loc && LOCATION_TO_MESA[loc] ? LOCATION_TO_MESA[loc] : "agendamento";
        }
        return base44.entities.ProductionOrder.update(po.id, {
          current_sector: nextSector,
          sector_started_at: null,
          current_step_index: (po.current_step_index || 0) + 1,
          status: "em_producao",
        });
      }

      // Special logic for mesas: → agendamento
      if (isMesa) {
        return base44.entities.ProductionOrder.update(po.id, {
          current_sector: "agendamento",
          sector_started_at: null,
          current_step_index: (po.current_step_index || 0) + 1,
          status: "em_producao",
        });
      }

      // Normal flow
      const nextIndex = (po.current_step_index || 0) + 1;
      const sequence = po.production_sequence || [];
      if (nextIndex >= sequence.length) {
        return base44.entities.ProductionOrder.update(po.id, {
          current_step_index: nextIndex, current_sector: "",
          status: "finalizado", finished_at: finishedAt,
        });
      } else {
        return base44.entities.ProductionOrder.update(po.id, {
          current_step_index: nextIndex,
          current_sector: sequence[nextIndex],
          sector_started_at: null,
          status: "em_producao",
        });
      }
    },
    onSuccess: () => {
      invalidateAll();
      setCompleting(null);
      setCompletionForm({ observations: "", changes: "", operator: "" });
      setEmbalagemDest("auto");
      setQcForm({
        inspector: "", visual_appearance: "na", dimensions: "na", finish_quality: "na",
        paint_quality: "na", electrical_test: "na", assembly_integrity: "na", packaging: "na",
        overall_result: "aprovado", qc_observations: "", correction_sector: "",
      });
    },
  });

  const filterOrders = (orders) =>
    orders.filter(po =>
      !search ||
      po.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      po.unique_number?.toLowerCase().includes(search.toLowerCase()) ||
      po.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      po.reference?.toLowerCase().includes(search.toLowerCase())
    );

  const waiting = filterOrders(productionOrders.filter(po => !po.sector_status || po.sector_status === "aguardando"));
  const inProgress = filterOrders(productionOrders.filter(po => po.sector_status === "em_producao"));
  const doneHere = filterOrders(productionOrders.filter(po => po.sector_status === "concluido"));
  const passed = filterOrders(allRelevantOrders);
  const doneAll = [...doneHere, ...passed.filter(p => !doneHere.some(d => d.id === p.id))];
  const returns = filterOrders(productionOrders.filter(po => po.return_from_sector?.has_issues));

  // Group by order
  const groupByOrder = (pos) => {
    const map = {};
    pos.forEach(po => {
      const key = po.order_id || po.order_number;
      if (!map[key]) {
        const order = allOrders.find(o => o.id === po.order_id);
        map[key] = {
          orderNumber: po.order_number, orderId: po.order_id,
          deliveryDeadline: po.delivery_deadline || order?.delivery_deadline,
          observations: po.observations || order?.observations,
          pos: [],
        };
      }
      map[key].pos.push(po);
    });
    return Object.values(map);
  };

  const activeForGroup = filterOrders(productionOrders.filter(po => po.sector_status !== "concluido"));
  const activeGroups = groupByOrder(activeForGroup);
  const doneGroups = groupByOrder(doneAll);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <ArrowRight className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{sectorLabel}</h1>
            <p className="text-sm text-muted-foreground">
              {isAssembly || (!isIndividual && !isMesa && !isEmbalagem)
                ? `${activeGroups.length} pedidos · ${productionOrders.length} OPs`
                : `${productionOrders.length} ordens`} neste setor
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1.5 bg-amber-50 border-amber-200 text-amber-700">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />{waiting.length} aguardando
          </Badge>
          <Badge variant="outline" className="gap-1.5 bg-blue-50 border-blue-200 text-blue-700">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />{inProgress.length} em produção
          </Badge>
          <Badge variant="outline" className="gap-1.5 bg-emerald-50 border-emerald-200 text-emerald-700">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{doneAll.length} concluídos
          </Badge>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar OP, produto, pedido..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-center p-8 text-muted-foreground">Carregando...</div>
      ) : isAssembly ? (
        /* ── MONTAGENS: Kanban por pedido → ambiente ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Retornos */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 bg-background py-1 z-10">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-red-500" />
              <span className="font-semibold text-sm">Retornos</span>
              <Badge variant="secondary" className="text-xs ml-auto">{returns.length}</Badge>
            </div>
            <div className="space-y-2.5">
              {returns.length === 0 ? (
                <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum retorno</div>
              ) : returns.map(po => (
                <div key={po.id} className="bg-card rounded-xl border border-red-200 p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">{po.unique_number}</span>
                    <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200 py-0.5">⚠ Retorno</Badge>
                  </div>
                  <p className="font-semibold text-sm">{po.product_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{po.environment || "Sem ambiente"}</p>
                  {po.return_from_sector?.issue_quantity > 0 && (
                    <p className="text-xs text-red-600 font-medium mt-1">Qtd com problemas: <strong>{po.return_from_sector.issue_quantity}</strong>/{po.quantity}</p>
                  )}
                  <Button size="sm" className="mt-2.5 w-full gap-1 bg-red-600 hover:bg-red-700 text-xs" onClick={() => handleStartClick(po)}>
                    <AlertTriangle className="w-3 h-3" /> Corrigir
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Pedidos Ativos */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 bg-background py-1 z-10">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-blue-500" />
              <span className="font-semibold text-sm">Pedidos Ativos</span>
              <Badge variant="secondary" className="text-xs ml-auto">{activeGroups.filter(g => !g.pos.some(p => p.return_from_sector?.has_issues)).length}</Badge>
            </div>
            <div className="space-y-3">
              {activeGroups.filter(g => !g.pos.some(p => p.return_from_sector?.has_issues)).length === 0 ? (
                <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum pedido ativo</div>
              ) : activeGroups.filter(g => !g.pos.some(p => p.return_from_sector?.has_issues)).map(g => (
                <AssemblyOrderCard
                  key={g.orderId || g.orderNumber}
                  {...g}
                  onStart={handleStartClick}
                  onComplete={setCompleting}
                  onDetail={setDetailPO}
                />
              ))}
            </div>
          </div>

          {/* Concluídos */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 bg-background py-1 z-10">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500" />
              <span className="font-semibold text-sm">Concluídos</span>
              <Badge variant="secondary" className="text-xs ml-auto">{doneGroups.length}</Badge>
            </div>
            <div className="space-y-2.5">
              {doneGroups.length === 0 ? (
                <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum concluído</div>
              ) : doneGroups.map(g => (
                <GhostGroupCard key={g.orderId || g.orderNumber} {...g} onDetail={setDetailPO} />
              ))}
            </div>
          </div>
        </div>
      ) : isIndividual || isMesa || isEmbalagem ? (
        /* ── INDIVIDUAL: estamparia, tornearia, mesas, embalagem ── */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <KanbanColumn title="Retornos" colorClass="bg-red-500" count={returns.length}>
            {returns.length === 0 ? (
              <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum retorno</div>
            ) : returns.map(po => (
              <div key={po.id} className="bg-card rounded-xl border-l-4 border-l-red-500 border p-3 hover:shadow-md">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">{po.unique_number}</span>
                  <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 py-0.5 gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" />Retorno
                  </Badge>
                </div>
                <p className="font-semibold text-sm">{po.product_name}</p>
                {po.return_from_sector?.issue_quantity > 0 && (
                  <p className="text-xs text-red-600 font-medium mt-1">Qtd com problemas: <strong>{po.return_from_sector.issue_quantity}</strong></p>
                )}
                <Button size="sm" className="mt-3 w-full gap-1 bg-red-600 hover:bg-red-700" onClick={() => handleStartClick(po)}>
                  <AlertTriangle className="w-3.5 h-3.5" /> Corrigir
                </Button>
              </div>
            ))}
          </KanbanColumn>
          <KanbanColumn title="Aguardando" colorClass="bg-amber-400" count={waiting.filter(p => !p.return_from_sector?.has_issues).length}>
            {waiting.filter(p => !p.return_from_sector?.has_issues).length === 0 ? (
              <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma aguardando</div>
            ) : waiting.filter(p => !p.return_from_sector?.has_issues).map(po => (
              <OrderCard key={po.id} po={po} onStart={handleStartClick} onComplete={setCompleting} onDetail={setDetailPO} />
            ))}
          </KanbanColumn>
          <KanbanColumn title="Em Produção" colorClass="bg-blue-500" count={inProgress.length}>
            {inProgress.length === 0 ? (
              <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma em produção</div>
            ) : inProgress.map(po => (
              <OrderCard key={po.id} po={po} onStart={handleStartClick} onComplete={setCompleting} onDetail={setDetailPO} />
            ))}
          </KanbanColumn>
          <KanbanColumn title="Concluído" colorClass="bg-emerald-500" count={doneAll.length}>
            {doneAll.length === 0 ? (
              <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma concluída</div>
            ) : doneAll.map(po => <GhostCard key={po.id} po={po} onDetail={setDetailPO} />)}
          </KanbanColumn>
        </div>
      ) : (
        /* ── DEMAIS SETORES: por pedido (3 colunas) ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div>
            <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 bg-background py-1 z-10">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-red-500" />
              <span className="font-semibold text-sm">Retornos</span>
              <Badge variant="secondary" className="text-xs ml-auto">{returns.length}</Badge>
            </div>
            <div className="space-y-2.5">
              {returns.length === 0 ? (
                <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum retorno</div>
              ) : returns.map(po => (
                <div key={po.id} className="bg-card rounded-xl border border-red-200 p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">{po.unique_number}</span>
                    <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">⚠ Retorno</Badge>
                  </div>
                  <p className="font-semibold text-sm">{po.product_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ped. #{po.order_number}</p>
                  {po.return_from_sector?.issue_quantity > 0 && (
                    <p className="text-xs text-red-600 font-medium mt-1">Qtd com problemas: <strong>{po.return_from_sector.issue_quantity}</strong>/{po.quantity}</p>
                  )}
                  <Button size="sm" className="mt-2.5 w-full gap-1 bg-red-600 hover:bg-red-700 text-xs" onClick={() => handleStartClick(po)}>
                    <AlertTriangle className="w-3 h-3" /> Corrigir
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 bg-background py-1 z-10">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-blue-500" />
              <span className="font-semibold text-sm">Pedidos Ativos</span>
              <Badge variant="secondary" className="text-xs ml-auto">{activeGroups.filter(g => !g.pos.some(p => p.return_from_sector?.has_issues)).length}</Badge>
            </div>
            <div className="space-y-3">
              {activeGroups.filter(g => !g.pos.some(p => p.return_from_sector?.has_issues)).length === 0 ? (
                <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum pedido ativo</div>
              ) : activeGroups.filter(g => !g.pos.some(p => p.return_from_sector?.has_issues)).map(g => {
                const order = allOrders.find(o => o.id === g.orderId);
                return (
                  <div key={g.orderId || g.orderNumber} className="bg-card rounded-xl border border-border/60 overflow-hidden hover:shadow-md">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <Link to={`/pedidos/${g.orderId}`} className="font-bold text-sm hover:text-primary flex items-center gap-1">
                          Pedido #{g.orderNumber} <ExternalLink className="w-3 h-3 opacity-50" />
                        </Link>
                        {g.deliveryDeadline && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Prazo: {format(new Date(g.deliveryDeadline), "dd/MM/yy")}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">{g.pos.length} OPs</Badge>
                    </div>
                    <div className="px-3 pb-3 space-y-1.5">
                      {g.pos.map(po => (
                        <PORow key={po.id} po={po} onStart={handleStartClick} onComplete={setCompleting} onDetail={setDetailPO} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 bg-background py-1 z-10">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500" />
              <span className="font-semibold text-sm">Concluídos neste Setor</span>
              <Badge variant="secondary" className="text-xs ml-auto">{doneGroups.length}</Badge>
            </div>
            <div className="space-y-2.5">
              {doneGroups.length === 0 ? (
                <div className="bg-muted/40 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum concluído</div>
              ) : doneGroups.map(g => (
                <GhostGroupCard key={g.orderId || g.orderNumber} {...g} onDetail={setDetailPO} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <PODetailModal po={detailPO} open={!!detailPO} onClose={() => setDetailPO(null)} />

      <StockDeductionAlert
        open={!!stockAlert}
        onClose={() => { setStockAlert(null); setStartingPO(null); }}
        onConfirm={confirmStart}
        deductions={stockAlert?.deductions}
        loading={startMutation.isPending}
      />

      <ReturnIssueDialog
        open={!!returnIssueDialog}
        po={returnIssueDialog}
        onClose={() => { setReturnIssueDialog(null); setReturnData(null); }}
        onContinue={(data) => {
          setReturnData(data);
          if (data.has_issues) {
            notify(
              `Problemas Identificados no Retorno — ${returnIssueDialog.product_name}`,
              "return_issue",
              { unique_number: returnIssueDialog.unique_number, product_name: returnIssueDialog.product_name, issue_quantity: data.issue_quantity }
            );
          }
          startMutation.mutate(returnIssueDialog);
        }}
        loading={startMutation.isPending}
      />

      {/* Complete Dialog */}
      <Dialog open={!!completing} onOpenChange={() => setCompleting(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Concluir — {sectorLabel}
            </DialogTitle>
          </DialogHeader>
          {completing && (
            <div className="space-y-4">
              <div className="bg-muted/60 rounded-xl p-3 text-sm space-y-0.5">
                <p className="font-semibold">{completing.unique_number} · {completing.product_name}</p>
                <p className="text-muted-foreground text-xs">Pedido: {completing.order_number} · Qtd: {completing.quantity}</p>
                {completing.sector_started_at && (
                  <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    Duração: {formatDistanceStrict(new Date(completing.sector_started_at), new Date(), { locale: ptBR })}
                  </p>
                )}
                {/* Next sector info */}
                {isEmbalagem ? (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    Destino automático:
                    <strong className="text-foreground">
                      {completing.purchase_location && LOCATION_TO_MESA[completing.purchase_location]
                        ? SECTOR_LABELS[LOCATION_TO_MESA[completing.purchase_location]]
                        : "Agendamento"}
                    </strong>
                  </p>
                ) : isMesa ? (
                  <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Próximo: Agendamento
                  </p>
                ) : (() => {
                  const nextIdx = (completing.current_step_index || 0) + 1;
                  const seq = completing.production_sequence || [];
                  const next = seq[nextIdx];
                  return next ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      Próximo: <strong className="text-foreground">{SECTOR_LABELS[next] || next}</strong>
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-600 font-medium mt-1">✓ Último setor — OP será finalizada</p>
                  );
                })()}
              </div>

              <div>
                <Label className="text-xs">Operador</Label>
                <Input
                  placeholder="Nome do operador..."
                  value={completionForm.operator}
                  onChange={e => setCompletionForm(p => ({ ...p, operator: e.target.value }))}
                  className="mt-1"
                />
              </div>

              {/* Embalagem: QC Checklist */}
              {isEmbalagem && (
                <div className="space-y-3 border rounded-xl p-3 bg-muted/30">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Checklist de Qualidade
                  </p>
                  {QC_CHECK_ITEMS.map(item => (
                    <div key={item.key} className="flex items-center justify-between">
                      <span className="text-xs">{item.label}</span>
                      <div className="flex gap-1">
                        {["aprovado", "reprovado", "na"].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setQcForm(p => ({ ...p, [item.key]: val }))}
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-medium transition-all",
                              qcForm[item.key] === val
                                ? val === "aprovado" ? "bg-emerald-500 text-white" : val === "reprovado" ? "bg-red-500 text-white" : "bg-gray-400 text-white"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {val === "na" ? "N/A" : val === "aprovado" ? "OK" : "NOK"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div>
                    <Label className="text-xs">Resultado Final</Label>
                    <Select value={qcForm.overall_result} onValueChange={v => setQcForm(p => ({ ...p, overall_result: v, correction_sector: "" }))}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aprovado">✅ Aprovado</SelectItem>
                        <SelectItem value="retrabalho">🔁 Retrabalho</SelectItem>
                        <SelectItem value="reprovado">❌ Reprovado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {qcNeedsCorrection && (
                    <div>
                      <Label className="text-xs flex items-center gap-1 text-amber-700"><AlertTriangle className="w-3 h-3" /> Setor de Correção *</Label>
                      <Select value={qcForm.correction_sector} onValueChange={v => setQcForm(p => ({ ...p, correction_sector: v }))}>
                        <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {SECTORS.filter(s => !["embalagem", "controle_qualidade", "agendamento", "expedicao"].includes(s.id)).map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!qcNeedsCorrection && (
                    <div>
                      <Label className="text-xs flex items-center gap-1"><Truck className="w-3 h-3" /> Destino após aprovação</Label>
                      <Select value={embalagemDest} onValueChange={setEmbalagemDest}>
                        <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automático (pela localização da compra)</SelectItem>
                          <SelectItem value="agendamento">Agendamento</SelectItem>
                          <SelectItem value="expedicao">Expedição direta</SelectItem>
                          {PURCHASE_LOCATIONS.map(loc => (
                            <SelectItem key={loc.mesa} value={loc.mesa}>{SECTOR_LABELS[loc.mesa]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Mudanças / Ajustes no Item
                </Label>
                <Textarea
                  value={completionForm.changes}
                  onChange={e => setCompletionForm(p => ({ ...p, changes: e.target.value }))}
                  placeholder="Ajustes de medida, troca de peça, correção de cor..."
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Observações gerais</Label>
                <Textarea
                  value={completionForm.observations}
                  onChange={e => setCompletionForm(p => ({ ...p, observations: e.target.value }))}
                  placeholder="O que foi feito, problemas encontrados..."
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setCompleting(null)}>Cancelar</Button>
                <Button
                  onClick={() => completeMutation.mutate({ po: completing, ...completionForm, destOverride: embalagemDest, qc: isEmbalagem ? qcForm : null })}
                  disabled={completeMutation.isPending || (isEmbalagem && qcNeedsCorrection && !qcForm.correction_sector)}
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {completeMutation.isPending ? "Salvando..." : "Confirmar Conclusão"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}