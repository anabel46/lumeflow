import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

export default function OrderForm({ open, onClose, onSubmit, initialData }) {
  const [form, setForm] = useState(initialData || {
    order_number: "",
    client_name: "",
    request_date: new Date().toISOString().split("T")[0],
    delivery_deadline: "",
    cost_center: "",
    environment: "",
    status: "aguardando",
    observations: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

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
              <Input value={form.order_number} onChange={(e) => update("order_number", e.target.value)} required />
            </div>
            <div>
              <Label>Cliente *</Label>
              <Input value={form.client_name} onChange={(e) => update("client_name", e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de Solicitação *</Label>
              <Input type="date" value={form.request_date} onChange={(e) => update("request_date", e.target.value)} required />
            </div>
            <div>
              <Label>Prazo de Entrega</Label>
              <Input type="date" value={form.delivery_deadline} onChange={(e) => update("delivery_deadline", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Centro de Custo</Label>
              <Input value={form.cost_center} onChange={(e) => update("cost_center", e.target.value)} />
            </div>
            <div>
              <Label>Ambiente</Label>
              <Input value={form.environment} onChange={(e) => update("environment", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="em_producao">Em Produção</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observations} onChange={(e) => update("observations", e.target.value)} rows={3} />
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