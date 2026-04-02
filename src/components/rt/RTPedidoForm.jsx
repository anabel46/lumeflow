import React, { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RTCalculator from "./RTCalculator";
import EmailGenerator from "./EmailGenerator";

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "em_processo", label: "Em Processo" },
  { value: "aguardando_nf", label: "Aguardando NF" },
  { value: "lancado_movimentacao", label: "Lançado na Movimentação" },
  { value: "pagamento_realizado", label: "Pagamento Realizado" },
];

export default function RTPedidoForm({
  open,
  onClose,
  onSubmit,
  initialData,
  arquitetos,
  isLoading,
}) {
  const [formData, setFormData] = useState(
    initialData || {
      codigo_pedido: "",
      numero_cliente: "",
      loja: "",
      valor_total_pedido: 0,
      valor_componentes: 0,
      valor_base_rt: 0,
      valor_rt: 0,
      mes_referencia: new Date().toISOString().slice(0, 7),
      status: "pendente",
      nome_arquiteto: "",
      arquiteto_id: "",
      observacoes: "",
    }
  );

  const handleCalculate = useCallback(
    (calculatedValues) => {
      setFormData((prev) => ({ ...prev, ...calculatedValues }));
    },
    []
  );

  const handleSubmit = () => {
    if (!formData.codigo_pedido || !formData.nome_arquiteto) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }
    onSubmit(formData);
  };

  const selectedArquiteto = arquitetos.find(
    (a) => a.nome === formData.nome_arquiteto
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            {initialData ? "Editar Pedido RT" : "Novo Pedido RT"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white">Informações Básicas</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-400">Código do Pedido *</Label>
                <Input
                  value={formData.codigo_pedido}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, codigo_pedido: e.target.value }))
                  }
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                  placeholder="EX001"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-400">Número Cliente</Label>
                <Input
                  value={formData.numero_cliente}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, numero_cliente: e.target.value }))
                  }
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-400">Loja</Label>
                <Input
                  value={formData.loja}
                  onChange={(e) => setFormData((p) => ({ ...p, loja: e.target.value }))}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-400">Mês de Referência</Label>
                <Input
                  type="month"
                  value={formData.mes_referencia}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, mes_referencia: e.target.value }))
                  }
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
          </div>

          {/* Arquiteto */}
          <div>
            <Label className="text-xs text-gray-400">Arquiteto *</Label>
            <Select
              value={formData.nome_arquiteto}
              onValueChange={(value) => {
                const arq = arquitetos.find((a) => a.nome === value);
                setFormData((p) => ({
                  ...p,
                  nome_arquiteto: value,
                  arquiteto_id: arq?.id,
                }));
              }}
            >
              <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Selecione um arquiteto" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {arquitetos.map((arq) => (
                  <SelectItem key={arq.id} value={arq.nome}>
                    {arq.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cálculo de RT */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <RTCalculator
              onCalculate={handleCalculate}
              initialData={formData}
            />
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-400">Data Faturamento</Label>
              <Input
                type="date"
                value={formData.data_faturamento || ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    data_faturamento: e.target.value,
                  }))
                }
                className="mt-1 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Data Pagamento</Label>
              <Input
                type="date"
                value={formData.data_pagamento || ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    data_pagamento: e.target.value,
                  }))
                }
                className="mt-1 bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs text-gray-400">Status</Label>
            <Select value={formData.status} onValueChange={(value) =>
              setFormData((p) => ({ ...p, status: value }))
            }>
              <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div>
            <Label className="text-xs text-gray-400">Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) =>
                setFormData((p) => ({ ...p, observacoes: e.target.value }))
              }
              className="mt-1 bg-gray-800 border-gray-700 text-white h-20"
              placeholder="Observações adicionais..."
            />
          </div>

          {/* Email Generator */}
          {initialData && selectedArquiteto && (
            <div>
              <Label className="text-xs text-gray-400">Gerador de E-mail</Label>
              <div className="mt-2">
                <EmailGenerator
                  pedidoRT={formData}
                  arquiteto={selectedArquiteto}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? "Salvando..." : "Salvar Pedido"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}