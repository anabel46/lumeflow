import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, ClipboardCheck, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SECTOR_LABELS, SECTORS } from "@/lib/constants";

const DOWNTIME_LABELS = {
  manutencao: "Manutenção",
  falta_material: "Falta de Material",
  problema_qualidade: "Problema de Qualidade",
  setup: "Setup / Troca",
  outros: "Outros",
};

const EMPTY_FORM = {
  operator: "",
  date: format(new Date(), "yyyy-MM-dd"),
  sector: "",
  production_order_id: "",
  unique_number: "",
  product_name: "",
  quantity_produced: 0,
  quantity_planned: 0,
  work_time_minutes: 0,
  downtime_minutes: 0,
  downtime_reason: "",
  observations: "",
};

function EfficiencyBadge({ efficiency }) {
  const color = efficiency >= 90 ? "bg-emerald-100 text-emerald-800" : efficiency >= 70 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return <Badge variant="outline" className={cn("text-xs font-bold", color)}>{efficiency.toFixed(0)}%</Badge>;
}

export default function Appointments() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [filterSector, setFilterSector] = useState("all");
  const queryClient = useQueryClient();

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => base44.entities.ProductionAppointment.list("-date", 500),
  });

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-orders-active"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProductionAppointment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

  const selectPO = (poId) => {
    const po = productionOrders.find(p => p.id === poId);
    if (po) {
      setForm(f => ({
        ...f,
        production_order_id: po.id,
        unique_number: po.unique_number,
        product_name: po.product_name,
        sector: po.current_sector || f.sector,
        quantity_planned: po.quantity,
      }));
    }
  };

  const filtered = appointments.filter(a => {
    const matchSearch = !search || a.operator?.toLowerCase().includes(search.toLowerCase()) || a.unique_number?.toLowerCase().includes(search.toLowerCase()) || a.product_name?.toLowerCase().includes(search.toLowerCase());
    const matchSector = filterSector === "all" || a.sector === filterSector;
    return matchSearch && matchSector;
  });

  const grouped = filtered.reduce((acc, a) => {
    const key = a.date || format(new Date(a.created_date), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalProduced = appointments.reduce((s, a) => s + (a.quantity_produced || 0), 0);
  const totalWork = appointments.reduce((s, a) => s + (a.work_time_minutes || 0), 0);
  const totalDowntime = appointments.reduce((s, a) => s + (a.downtime_minutes || 0), 0);
  const globalEfficiency = totalWork + totalDowntime > 0 ? ((totalWork / (totalWork + totalDowntime)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Apontamentos de Produção</h1>
          <p className="text-sm text-muted-foreground">Registro diário por operador</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Apontamento
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Produzido</p>
          <p className="text-2xl font-bold mt-1">{totalProduced}</p>
          <p className="text-xs text-muted-foreground">itens registrados</p>
        </div>
        <div className="bg-card rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Tempo Trabalhado</p>
          <p className="text-2xl font-bold mt-1">{Math.floor(totalWork / 60)}h {totalWork % 60}m</p>
          <p className="text-xs text-muted-foreground">total acumulado</p>
        </div>
        <div className="bg-card rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Paradas Técnicas</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{Math.floor(totalDowntime / 60)}h {totalDowntime % 60}m</p>
          <p className="text-xs text-muted-foreground">tempo improdutivo</p>
        </div>
        <div className="bg-card rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Eficiência Global</p>
          <p className={cn("text-2xl font-bold mt-1", globalEfficiency >= 90 ? "text-emerald-600" : globalEfficiency >= 70 ? "text-amber-600" : "text-red-600")}>
            {globalEfficiency.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground">tempo útil / total</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar operador, OP, produto..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterSector} onValueChange={setFilterSector}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os setores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {SECTORS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {sortedDates.length === 0 ? (
        <div className="bg-card rounded-2xl border p-12 text-center text-muted-foreground">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum apontamento registrado</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => {
            const dayItems = grouped[date];
            const dayProduced = dayItems.reduce((s, a) => s + (a.quantity_produced || 0), 0);
            const dayWork = dayItems.reduce((s, a) => s + (a.work_time_minutes || 0), 0);
            const dayDowntime = dayItems.reduce((s, a) => s + (a.downtime_minutes || 0), 0);
            const dayEff = dayWork + dayDowntime > 0 ? ((dayWork / (dayWork + dayDowntime)) * 100) : 100;

            return (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </h3>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{dayProduced} itens</span>
                  <EfficiencyBadge efficiency={dayEff} />
                </div>
                <div className="space-y-2">
                  {dayItems.map(a => {
                    const eff = a.work_time_minutes + (a.downtime_minutes || 0) > 0
                      ? (a.work_time_minutes / (a.work_time_minutes + (a.downtime_minutes || 0))) * 100
                      : 100;
                    return (
                      <div key={a.id} className="bg-card rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{a.operator}</span>
                            <Badge variant="outline" className="text-[10px]">{SECTOR_LABELS[a.sector] || a.sector}</Badge>
                            {a.unique_number && <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{a.unique_number}</span>}
                          </div>
                          {a.product_name && <p className="text-xs text-muted-foreground mt-0.5">{a.product_name}</p>}
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Produzido: <strong className="text-foreground">{a.quantity_produced}</strong>{a.quantity_planned ? `/${a.quantity_planned}` : ""}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Trabalho: <strong className="text-foreground">{a.work_time_minutes}min</strong></span>
                            {a.downtime_minutes > 0 && (
                              <span className="flex items-center gap-1 text-amber-600">
                                <AlertCircle className="w-3 h-3" /> Parada: {a.downtime_minutes}min {a.downtime_reason ? `(${DOWNTIME_LABELS[a.downtime_reason]})` : ""}
                              </span>
                            )}
                          </div>
                          {a.observations && <p className="text-xs text-muted-foreground mt-1 italic">"{a.observations}"</p>}
                        </div>
                        <EfficiencyBadge efficiency={eff} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Apontamento de Produção</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Operador *</Label>
                <Input value={form.operator} onChange={e => setForm(f => ({ ...f, operator: e.target.value }))} placeholder="Nome do operador" required />
              </div>
              <div>
                <Label>Data *</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
            </div>

            <div>
              <Label>Setor *</Label>
              <Select value={form.sector} onValueChange={v => setForm(f => ({ ...f, sector: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ordem de Produção (opcional)</Label>
              <Select value={form.production_order_id} onValueChange={selectPO}>
                <SelectTrigger><SelectValue placeholder="Vincular a uma OP..." /></SelectTrigger>
                <SelectContent>
                  {productionOrders.filter(po => po.status !== "finalizado").map(po => (
                    <SelectItem key={po.id} value={po.id}>{po.unique_number} — {po.product_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.product_name && (
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                Produto: <strong className="text-foreground">{form.product_name}</strong> | Qtd planejada: <strong className="text-foreground">{form.quantity_planned}</strong>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Qtd. Produzida *</Label>
                <Input type="number" min={0} value={form.quantity_produced} onChange={e => setForm(f => ({ ...f, quantity_produced: parseInt(e.target.value) || 0 }))} required />
              </div>
              <div>
                <Label>Tempo Trabalhado (min) *</Label>
                <Input type="number" min={0} value={form.work_time_minutes} onChange={e => setForm(f => ({ ...f, work_time_minutes: parseInt(e.target.value) || 0 }))} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Parada Técnica (min)</Label>
                <Input type="number" min={0} value={form.downtime_minutes} onChange={e => setForm(f => ({ ...f, downtime_minutes: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Motivo da Parada</Label>
                <Select value={form.downtime_reason} onValueChange={v => setForm(f => ({ ...f, downtime_reason: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOWNTIME_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} placeholder="Problemas encontrados, ajustes realizados..." rows={2} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || !form.operator || !form.sector}>
                {createMutation.isPending ? "Salvando..." : "Registrar Apontamento"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}