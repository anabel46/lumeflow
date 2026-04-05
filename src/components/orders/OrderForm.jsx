import React, { useState } from "react";
import { addDays, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info, MapPin } from "lucide-react";
import { PURCHASE_LOCATIONS } from "@/lib/constants";

const DEFAULT_DELIVERY_DAYS = 20;

export default function OrderForm({ open, onClose, onSubmit, initialData }) {
  const today = new Date().toISOString().split("T")[0];
  const defaultDeadline = format(addDays(new Date(), DEFAULT_DELIVERY_DAYS), "yyyy-MM-dd");

  const [form, setForm] = useState(initialData || {
    order_number: "",
    client_name: "",
    request_date: today,
    delivery_deadline: defaultDeadline,
    delivery_type: "normal",
    purchase_location: "",
    cost_center: "",
    environment: "",
    status: "aprovacao_pendente",
    observations: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleRequestDateChange = (val) => {
    update("request_date", val);
    // Auto-recalculate deadline only for normal delivery and if not editing
    if (form.delivery_type === "normal" && val) {
      const newDeadline = format(addDays(new Date(val + "T12:00:00"), DEFAULT_DELIVERY_DAYS), "yyyy-MM-dd");
      update("delivery_deadline", newDeadline);
    }
  };

  const handleDeliveryTypeChange = (val) => {
    update("delivery_type", val);
    if (val === "normal" && form.request_date) {
      const newDeadline = format(addDays(new Date(form.request_date + "T12:00:00"), DEFAULT_DELIVERY_DAYS), "yyyy-MM-dd");
      update("delivery_deadline", newDeadline);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Pedido" : "Novo Pedido"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nº do Pedido *</Label>
              <Input value={form.order_number} onChange={(e) => update("order_number", e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label>Cliente *</Label>
              <Input value={form.client_name} onChange={(e) => update("client_name", e.target.value)} required className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de Solicitação *</Label>
              <Input type="date" value={form.request_date} onChange={(e) => handleRequestDateChange(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label>Tipo de Entrega</Label>
              <Select value={form.delivery_type || "normal"} onValueChange={handleDeliveryTypeChange}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal (20 dias)</SelectItem>
                  <SelectItem value="posterior">Fabricação Posterior</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.delivery_type === "posterior" && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Fabricação posterior — o cliente solicitará a entrega em data futura (obras, viagem etc.). Informe o prazo acordado.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prazo de Entrega</Label>
              <Input type="date" value={form.delivery_deadline} onChange={(e) => update("delivery_deadline", e.target.value)} className="mt-1" />
              {form.delivery_type === "normal" && (
                <p className="text-[11px] text-muted-foreground mt-1">Calculado automaticamente (+20 dias)</p>
              )}
            </div>
            <div>
              <Label>Centro de Custo</Label>
              <Input value={form.cost_center} onChange={(e) => update("cost_center", e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Localização da Compra <span className="text-muted-foreground font-normal text-xs">(loja/unidade)</span></Label>
            <Select value={form.purchase_location || ""} onValueChange={(v) => update("purchase_location", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a loja..." /></SelectTrigger>
              <SelectContent>
                {PURCHASE_LOCATIONS.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">Determina a mesa de destino após embalagem</p>
          </div>

          <div>
            <Label>Ambiente <span className="text-muted-foreground font-normal text-xs">(espaço da casa)</span></Label>
            <Input value={form.environment} onChange={(e) => update("environment", e.target.value)} placeholder="Ex: Sala de estar, Quarto, Hall..." className="mt-1" />
          </div>

          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aprovacao_pendente">Aprovação Pendente</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="em_producao">Em Produção</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observações <span className="text-muted-foreground font-normal text-xs">(informações complementares do comercial)</span></Label>
            <Textarea value={form.observations} onChange={(e) => update("observations", e.target.value)} rows={3} className="mt-1" placeholder="Informações complementares, solicitações especiais..." />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}