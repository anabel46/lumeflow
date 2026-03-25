import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Pencil, GripVertical } from "lucide-react";
import { SECTORS, SECTOR_LABELS } from "@/lib/constants";

export default function Catalog() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date", 500),
  });

  const [form, setForm] = useState({
    reference: "", name: "", category: "lustre", description: "",
    technical_drawing_url: "", image_url: "", production_sequence: [], estimated_time_minutes: 0,
  });

  const openCreate = () => {
    setForm({ reference: "", name: "", category: "lustre", description: "", technical_drawing_url: "", image_url: "", production_sequence: [], estimated_time_minutes: 0 });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setForm({ ...p });
    setEditing(p);
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Product.update(editing.id, data) : base44.entities.Product.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); setShowForm(false); },
  });

  const toggleSector = (sectorId) => {
    setForm(prev => {
      const seq = prev.production_sequence || [];
      return { ...prev, production_sequence: seq.includes(sectorId) ? seq.filter(s => s !== sectorId) : [...seq, sectorId] };
    });
  };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) || p.reference?.toLowerCase().includes(search.toLowerCase())
  );

  const categoryLabels = { lustre: "Lustre", luminaria: "Luminária", pendente: "Pendente", arandela: "Arandela", plafon: "Plafon", spot: "Spot", outro: "Outro" };

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(prev => ({ ...prev, [field]: file_url }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de Produtos</h1>
          <p className="text-sm text-muted-foreground">Produtos com sequência de produção</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo Produto</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou referência..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((product) => (
          <div key={product.id} className="bg-card rounded-2xl border p-5 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-mono text-muted-foreground">{product.reference}</p>
                <h3 className="font-semibold mt-1">{product.name}</h3>
                <Badge variant="outline" className="text-xs mt-2">{categoryLabels[product.category] || product.category}</Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(product)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
            {product.production_sequence?.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Sequência de Produção</p>
                <div className="flex flex-wrap gap-1">
                  {product.production_sequence.map((s, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      {i + 1}. {SECTOR_LABELS[s] || s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Referência *</Label><Input value={form.reference} onChange={(e) => setForm(p => ({ ...p, reference: e.target.value }))} required /></div>
              <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Tempo Est. (min)</Label><Input type="number" value={form.estimated_time_minutes} onChange={(e) => setForm(p => ({ ...p, estimated_time_minutes: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div>
              <Label>Desenho Técnico (PDF)</Label>
              <Input type="file" accept=".pdf" onChange={(e) => handleFileUpload(e, "technical_drawing_url")} />
              {form.technical_drawing_url && <p className="text-xs text-emerald-600 mt-1">Arquivo enviado</p>}
            </div>
            <div>
              <Label>Imagem</Label>
              <Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "image_url")} />
              {form.image_url && <img src={form.image_url} alt="Preview" className="w-20 h-20 object-cover rounded-lg mt-2" />}
            </div>
            <div>
              <Label>Sequência de Produção *</Label>
              <p className="text-xs text-muted-foreground mb-2">Selecione os setores na ordem de produção</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {SECTORS.map((sector) => (
                  <label key={sector.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={form.production_sequence?.includes(sector.id)}
                      onCheckedChange={() => toggleSector(sector.id)}
                    />
                    <span className="text-sm">{sector.label}</span>
                    {form.production_sequence?.includes(sector.id) && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        #{form.production_sequence.indexOf(sector.id) + 1}
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}