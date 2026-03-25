import React, { useState, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Printer, Search, X, Calendar, Store, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";
import { jsPDF } from "jspdf";

const REPORT_TYPES = [
  { value: "pedidos_producao", label: "Pedidos de Vendas em Produção" },
  { value: "pedidos_todos", label: "Todos os Pedidos" },
];

// ─── PDF Generation ────────────────────────────────────────────────────────
function generatePDF(groups, filters) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const marginL = 15;
  const marginR = 15;
  const contentW = W - marginL - marginR;
  let y = 0;

  const dateRange = [filters.dateFrom, filters.dateTo].filter(Boolean);
  const dateRangeStr = dateRange.length === 2
    ? `${format(new Date(filters.dateFrom), "dd/MM/yyyy")} – ${format(new Date(filters.dateTo), "dd/MM/yyyy")}`
    : dateRange.length === 1
    ? format(new Date(dateRange[0]), "dd/MM/yyyy")
    : "";

  const addPage = () => {
    doc.addPage();
    y = 15;
    drawPageHeader();
  };

  const checkY = (needed = 10) => {
    if (y + needed > 280) addPage();
  };

  const drawPageHeader = () => {
    // Generation date top-left
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(`Data de geração: ${format(new Date(), "dd/MM/yyyy HH.mm.ss")}`, marginL, 10);

    // Title center
    doc.setFontSize(16);
    doc.setTextColor(30);
    doc.setFont(undefined, "bold");
    doc.text("Pedidos de Vendas", W / 2, 10, { align: "center" });

    // Date range top-right
    if (dateRangeStr) {
      doc.setFontSize(8);
      doc.setFont(undefined, "normal");
      doc.setTextColor(60);
      const lines = dateRange.length === 2
        ? [format(new Date(filters.dateFrom), "dd/MM/yyyy"), format(new Date(filters.dateTo), "dd/MM/yyyy")]
        : [dateRangeStr];
      lines.forEach((l, i) => doc.text(l, W - marginR, 8 + i * 4, { align: "right" }));
    }

    // Sub-label
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.setFont(undefined, "normal");
    doc.text("Por data de negociação", W / 2 - 10, 17, { align: "center" });

    doc.setDrawColor(180);
    doc.line(marginL, 20, W - marginR, 20);
    y = 24;
  };

  // First page header
  drawPage(doc);
  drawPageHeader();

  groups.forEach((group) => {
    const { order, pos } = group;

    // Order header block
    const headerH = 8;
    checkY(headerH + 6);

    // Nro. único (top right of group)
    doc.setFontSize(7.5);
    doc.setTextColor(80);
    doc.setFont(undefined, "normal");
    doc.text(`Nro. único   ${group.uniqueNumber || ""}`, W - marginR, y, { align: "right" });

    // Left: date + order number + client
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.setFont(undefined, "bold");
    const orderDate = order.request_date ? format(new Date(order.request_date), "dd/MM/yy") : "";
    doc.text(`${orderDate}  Pedido: ${order.order_number}`, marginL, y + 5);
    doc.setFontSize(11);
    doc.text(order.client_name?.toUpperCase() || "", marginL + 55, y + 5);

    doc.setDrawColor(180);
    doc.line(marginL, y + 7, W - marginR, y + 7);
    y += 9;

    // PO rows
    pos.forEach((po) => {
      const lines = [];
      // Line 1: product name + qty + OP number
      const productLine = po.product_name || "";
      const qtyStr = `Qtd.: ${po.quantity}`;
      const opStr = `O.P.: ${po.op_number || ""}`;

      // Observations / complement
      const obs = [po.complement, po.observations].filter(Boolean).join("   ");

      // Estimate height
      const wrapped = doc.splitTextToSize(productLine, contentW - 40);
      const rowH = (wrapped.length * 4.5) + (obs ? 5 : 0) + 4;
      checkY(rowH);

      doc.setFontSize(8.5);
      doc.setFont(undefined, "normal");
      doc.setTextColor(20);

      // Product name (wrapping, left)
      doc.text(wrapped, marginL, y + 4);

      // Qty (right area)
      doc.setFont(undefined, "normal");
      doc.text(qtyStr, W - marginR - 28, y + 4);

      // OP number
      doc.setFont(undefined, "bold");
      doc.text(opStr, W - marginR - 12, y + 4);

      // Checkbox square
      doc.setDrawColor(120);
      doc.rect(W - marginR - 1, y + 1, 5, 5);

      y += wrapped.length * 4.5;

      if (obs) {
        doc.setFontSize(7.5);
        doc.setFont(undefined, "normal");
        doc.setTextColor(80);
        const obsWrapped = doc.splitTextToSize(`   ${obs}`, contentW - 10);
        doc.text(obsWrapped, marginL + 3, y + 3);
        y += obsWrapped.length * 4 + 2;
      } else {
        y += 3;
      }
    });

    y += 4; // gap between orders
  });

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.setFont(undefined, "normal");
    doc.text(`Página ${i} de ${totalPages}`, W / 2, 290, { align: "center" });
  }

  doc.save(`pedidos_producao_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}

// dummy to avoid linting error – actual page setup happens in drawPageHeader
function drawPage() {}

// ─── Preview Row ────────────────────────────────────────────────────────────
function PreviewOrderGroup({ group }) {
  const { order, pos, uniqueNumber } = group;
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-bold text-sm">
            {order.request_date ? format(new Date(order.request_date), "dd/MM/yy") : ""}{" "}
            Pedido: <span className="text-primary">{order.order_number}</span>
          </span>
          <span className="font-semibold text-sm">{order.client_name}</span>
          {order.cost_center && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Store className="w-3 h-3" />{order.cost_center}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {uniqueNumber && (
            <span className="text-[11px] text-muted-foreground">Nro. único: <strong>{uniqueNumber}</strong></span>
          )}
          <Badge variant="secondary" className="text-xs">{pos.length} OPs</Badge>
        </div>
      </button>

      {expanded && (
        <div className="divide-y">
          {pos.map((po, i) => (
            <div key={po.id || i} className="px-4 py-2.5 flex items-start justify-between gap-3 hover:bg-muted/20">
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">{po.product_name}</p>
                {(po.complement || po.observations) && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    {[po.complement, po.observations].filter(Boolean).join("   ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0 text-sm">
                <span className="text-muted-foreground text-xs">Qtd.: <strong className="text-foreground">{po.quantity}</strong></span>
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                  O.P.: {po.op_number || po.unique_number}
                </span>
                <div className="w-4 h-4 border border-border rounded-sm shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Reports() {
  const [reportType, setReportType] = useState("pedidos_producao");
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    search: "",
    empresa: "",
    parceiro: "",
    status: "all",
  });

  const { data: productionOrders = [], isLoading: loadingPO } = useQuery({
    queryKey: ["production-orders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 1000),
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["orders"],
    queryFn: () => base44.entities.Order.list("-created_date", 1000),
  });

  const isLoading = loadingPO || loadingOrders;

  const orderMap = useMemo(() => {
    const m = {};
    orders.forEach(o => { m[o.id] = o; });
    return m;
  }, [orders]);

  // Filter and group
  const groups = useMemo(() => {
    let pos = [...productionOrders];

    // Report type filter
    if (reportType === "pedidos_producao") {
      pos = pos.filter(p => p.status !== "finalizado" && p.status !== "cancelado");
    }

    // Status filter
    if (filters.status !== "all") {
      pos = pos.filter(p => p.status === filters.status);
    }

    // Date range (by request_date of order or po)
    if (filters.dateFrom) {
      pos = pos.filter(p => {
        const order = orderMap[p.order_id];
        const d = order?.request_date || p.request_date;
        return d && d >= filters.dateFrom;
      });
    }
    if (filters.dateTo) {
      pos = pos.filter(p => {
        const order = orderMap[p.order_id];
        const d = order?.request_date || p.request_date;
        return d && d <= filters.dateTo;
      });
    }

    // Search
    if (filters.search) {
      const s = filters.search.toLowerCase();
      pos = pos.filter(p => {
        const order = orderMap[p.order_id];
        return (
          p.order_number?.toLowerCase().includes(s) ||
          p.unique_number?.toLowerCase().includes(s) ||
          p.product_name?.toLowerCase().includes(s) ||
          order?.client_name?.toLowerCase().includes(s)
        );
      });
    }

    // Empresa
    if (filters.empresa) {
      const e = filters.empresa.toLowerCase();
      pos = pos.filter(p => {
        const order = orderMap[p.order_id];
        return (p.cost_center || order?.cost_center)?.toLowerCase().includes(e);
      });
    }

    // Parceiro
    if (filters.parceiro) {
      const p2 = filters.parceiro.toLowerCase();
      pos = pos.filter(p => {
        const order = orderMap[p.order_id];
        return order?.client_name?.toLowerCase().includes(p2);
      });
    }

    // Group by order
    const map = {};
    pos.forEach(po => {
      const key = po.order_id || po.order_number;
      const order = orderMap[po.order_id] || {
        id: po.order_id,
        order_number: po.order_number,
        client_name: "",
        cost_center: po.cost_center,
        request_date: po.request_date,
        delivery_deadline: po.delivery_deadline,
      };
      if (!map[key]) {
        map[key] = {
          order,
          uniqueNumber: po.unique_number,
          pos: [],
        };
      }
      map[key].pos.push({
        ...po,
        op_number: po.unique_number,
      });
    });

    // Sort by order request_date desc
    return Object.values(map).sort((a, b) => {
      const da = a.order.request_date || "";
      const db = b.order.request_date || "";
      return db.localeCompare(da);
    });
  }, [productionOrders, orders, orderMap, reportType, filters]);

  const totalPOs = groups.reduce((acc, g) => acc + g.pos.length, 0);

  const setFilter = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

  const clearFilters = () => setFilters({ dateFrom: "", dateTo: "", search: "", empresa: "", parceiro: "", status: "all" });

  const hasFilters = filters.dateFrom || filters.dateTo || filters.search || filters.empresa || filters.parceiro || filters.status !== "all";

  const handlePDF = () => generatePDF(groups, filters);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Relatórios
          </h1>
          <p className="text-sm text-muted-foreground">Gere e exporte relatórios de produção</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <Button onClick={handlePDF} className="gap-2" disabled={groups.length === 0}>
            <Download className="w-4 h-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      {/* Report type */}
      <div className="bg-card border rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs mb-1 block">Tipo de Relatório</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Status da OP</Label>
            <Select value={filters.status} onValueChange={v => setFilter("status", v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="planejamento">Planejamento</SelectItem>
                <SelectItem value="em_producao">Em Produção</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Busca Geral</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Pedido, OP, produto, cliente..."
                className="pl-8 h-9 text-sm"
                value={filters.search}
                onChange={e => setFilter("search", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" />Data De</Label>
            <Input type="date" className="h-9 text-sm" value={filters.dateFrom} onChange={e => setFilter("dateFrom", e.target.value)} />
          </div>

          <div>
            <Label className="text-xs mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" />Data Até</Label>
            <Input type="date" className="h-9 text-sm" value={filters.dateTo} onChange={e => setFilter("dateTo", e.target.value)} />
          </div>

          <div>
            <Label className="text-xs mb-1 flex items-center gap-1"><Store className="w-3 h-3" />Empresa / Loja</Label>
            <Input
              placeholder="Filtrar por empresa..."
              className="h-9 text-sm"
              value={filters.empresa}
              onChange={e => setFilter("empresa", e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs mb-1 flex items-center gap-1"><User className="w-3 h-3" />Parceiro / Cliente</Label>
            <Input
              placeholder="Filtrar por cliente..."
              className="h-9 text-sm"
              value={filters.parceiro}
              onChange={e => setFilter("parceiro", e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{groups.length}</strong> pedido(s) ·{" "}
            <strong className="text-foreground">{totalPOs}</strong> OP(s)
          </p>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs h-7">
              <X className="w-3 h-3" /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-2" id="report-preview">
        {isLoading ? (
          <div className="text-center p-10 text-muted-foreground">Carregando dados...</div>
        ) : groups.length === 0 ? (
          <div className="bg-card rounded-2xl border p-10 text-center text-muted-foreground">
            Nenhum dado para os filtros selecionados
          </div>
        ) : (
          groups.map((group, i) => (
            <PreviewOrderGroup key={group.order.id || i} group={group} />
          ))
        )}
      </div>
    </div>
  );
}