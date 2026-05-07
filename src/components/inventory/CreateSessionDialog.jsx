import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

const STOCK_GROUPS = [
  { id: "importado", label: "Importado" },
  { id: "revenda_china", label: "Revenda China" },
  { id: "revenda_brasil", label: "Revenda Brasil" },
  { id: "mp_nacional", label: "MP Nacional" },
  { id: "epi_cabos", label: "EPI e Cabos" },
  { id: "gesso_fundicao", label: "Gesso e Fundição" },
  { id: "vidros_madeiras", label: "Vidros e Madeiras" },
  { id: "todos", label: "Todos" },
];

export default function CreateSessionDialog({ open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: "",
    stock_group: "importado",
    responsible: "",
    team: [],
    location: "",
    observations: "",
  });
  const [teamInput, setTeamInput] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.InventorySession.create({
        ...data,
        status: "em_andamento",
        started_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-sessions"] });
      toast.success("Sessão de inventário criada com sucesso!");
      onClose();
      setFormData({
        title: "",
        stock_group: "importado",
        responsible: "",
        team: [],
        location: "",
        observations: "",
      });
      setTeamInput("");
    },
    onError: (err) => {
      toast.error(`Erro ao criar sessão: ${err.message}`);
    },
  });

  const handleAddTeamMember = () => {
    if (teamInput.trim() && !formData.team.includes(teamInput.trim())) {
      setFormData(prev => ({
        ...prev,
        team: [...prev.team, teamInput.trim()],
      }));
      setTeamInput("");
    }
  };

  const handleRemoveTeamMember = (index) => {
    setFormData(prev => ({
      ...prev,
      team: prev.team.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = () => {
    if (!formData.title.trim() || !formData.responsible.trim()) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Sessão de Inventário</DialogTitle>
          <DialogDescription>
            Crie uma nova sessão de contagem de estoque. A sessão será iniciada imediatamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder='Ex: "Inventário Importado Março/2025"'
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="stock_group">Grupo de Estoque *</Label>
            <select
              id="stock_group"
              className="h-10 px-3 rounded-lg border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={formData.stock_group}
              onChange={(e) => setFormData(prev => ({ ...prev, stock_group: e.target.value }))}
            >
              {STOCK_GROUPS.map(group => (
                <option key={group.id} value={group.id}>{group.label}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="responsible">Responsável *</Label>
            <Input
              id="responsible"
              placeholder="Nome do responsável"
              value={formData.responsible}
              onChange={(e) => setFormData(prev => ({ ...prev, responsible: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="team">Equipe</Label>
            <div className="flex gap-2">
              <Input
                id="team"
                placeholder="Nome do membro da equipe"
                value={teamInput}
                onChange={(e) => setTeamInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTeamMember())}
              />
              <Button type="button" variant="outline" onClick={handleAddTeamMember}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {formData.team.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.team.map((member, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {member}
                    <button onClick={() => handleRemoveTeamMember(index)} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">Localização Física</Label>
            <Input
              id="location"
              placeholder='Ex: "Estoque D, A1-P001"'
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              placeholder="Observações adicionais sobre esta sessão..."
              rows={3}
              value={formData.observations}
              onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Criando..." : "Criar e Iniciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}