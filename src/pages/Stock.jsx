import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Warehouse, ArrowDownUp, AlertTriangle, Package, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function Stock() {
  const [showItemForm, setShowItemForm] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["stock-items"],
    queryFn: () => base44.entities.StockItem.list("name", 500),
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["stock-requests"],
    queryFn: () => base44.entities.StockRequest.list("-created_date", 200),
  });

  const [itemForm, setItemForm] = useState({ name: "", code: "", category: "", unit: "un", quantity_factory: 0, quantity_upper: 0, minimum_stock: 0 });
  const [reqForm, setReqForm] = useState({ stock_item_id: "", item_name: "", quantity_requested: 1, from_stock: "fabril", sector: "", observations: "" });

  const saveItemMutation = useMutation({
    mutationFn: (data) => editingItem ? base44.entities.StockItem.update(editingItem.id, data) : base44.entities.StockItem.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["stock-items"] }); setShowItemForm(false); setEditingItem(null); },
  });

  const createRequestMutation = useMutation({
    mutationFn: (data) => base44.entities.StockRequest.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["stock-requests"] }); setShowRequestForm(false); },
  });

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StockRequest.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-requests"] }),
  });

  const openEditItem = (item) => {
    setItemForm({ ...item });
    setEditingItem(item);
    setShowItemForm(true);
  };

  const openNewItem = () => {
    setItemForm({ name: "", code: "", category: "", unit: "un", quantity_factory: 0, quantity_upper: 0, minimum_stock: 0 });
    setEditingItem(null);
    setShowItemForm(true);
  };

  const lowStock = items.filter(i => (i.quantity_factory + i.quantity_upper) < i.minimum_stock);
  const filteredItems = items.filter(i => i.name?.toLowerCase().includes(search.toLowerCase()) || i.code?.toLowerCase().includes(search.toLowerCase()));

  const statusColors = { pendente: "bg-yellow-100 text-yellow-800", aprovado: "bg-blue-100 text-blue-800", rejeitado: "bg-red-100 text-red-800", entregue: "bg-emerald-100 text-emerald-800" };
  const statusLabels = { pendente: "Pendente", aprovado: "Aprovado", rejeitado: "Rejeitado", entregue: "Entregue" };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Estoque</h1>
          <p className="text-sm text-muted-foreground">Controle de estoque fabril e superior</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowRequestForm(true)} className="gap-2"><ArrowDownUp className="w-4 h-4" /> Solicitar</Button>
          <Button onClick={openNewItem} className="gap-2"><Plus className="w-4 h-4" /> Novo Item</Button>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Estoque Baixo</p>
            <p className="text-xs text-amber-700 mt-1">{lowStock.map(i => i.name).join(", ")}</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Itens ({items.length})</TabsTrigger>
          <TabsTrigger value="requests">Solicitações ({requests.filter(r => r.status === "pendente").length} pendentes)</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar item..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="bg-card rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium text-muted-foreground">Código</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Unid.</th>
                    <th className="text-center p-4 font-medium text-muted-foreground">Est. Fabril</th>
                    <th className="text-center p-4 font-medium text-muted-foreground">Est. Superior</th>
                    <th className="text-center p-4 font-medium text-muted-foreground">Mínimo</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const total = (item.quantity_factory || 0) + (item.quantity_upper || 0);
                    const isLow = total < (item.minimum_stock || 0);
                    return (
                      <tr key={item.id} className={cn("border-b hover:bg-muted/30 transition-colors", isLow && "bg-red-50/50")}>
                        <td className="p-4 font-mono text-xs">{item.code}</td>
                        <td className="p-4 font-medium">{item.name}</td>
                        <td className="p-4">{item.unit}</td>
                        <td className="p-4 text-center font-semibold">{item.quantity_factory}</td>
                        <td className="p-4 text-center font-semibold">{item.quantity_upper}</td>
                        <td className="p-4 text-center">{item.minimum_stock}</td>
                        <td className="p-4">
                          <Button variant="ghost" size="sm" onClick={() => openEditItem(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-card rounded-xl border p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold text-sm">{req.item_name}</p>
                <p className="text-xs text-muted-foreground">Qtd: {req.quantity_requested} | De: {req.from_stock === "fabril" ? "Estoque Fabril" : "Estoque Superior"} | Setor: {req.sector || "-"}</p>
                <p className="text-xs text-muted-foreground">{req.created_date ? format(new Date(req.created_date), "dd/MM/yyyy HH:mm") : ""}</p>
              </div>
              <Badge variant="outline" className={cn("text-xs", statusColors[req.status])}>{statusLabels[req.status]}</Badge>
              {req.status === "pendente" && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => updateRequestMutation.mutate({ id: req.id, data: { status: "aprovado" } })}>Aprovar</Button>
                  <Button size="sm" variant="outline" className="text-xs text-red-500" onClick={() => updateRequestMutation.mutate({ id: req.id, data: { status: "rejeitado" } })}>Rejeitar</Button>
                </div>
              )}
              {req.status === "aprovado" && (
                <Button size="sm" className="text-xs" onClick={() => updateRequestMutation.mutate({ id: req.id, data: { status: "entregue" } })}>Entregar</Button>
              )}
            </div>
          ))}
          {requests.length === 0 && <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground">Nenhuma solicitação</div>}
        </TabsContent>
      </Tabs>

      {/* Item Form Dialog */}
      <Dialog open={showItemForm} onOpenChange={setShowItemForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveItemMutation.mutate(itemForm); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Código *</Label><Input value={itemForm.code} onChange={e => setItemForm(p => ({ ...p, code: e.target.value }))} required /></div>
              <div><Label>Nome *</Label><Input value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))} required /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Categoria</Label><Input value={itemForm.category} onChange={e => setItemForm(p => ({ ...p, category: e.target.value }))} /></div>
              <div>
                <Label>Unidade</Label>
                <Select value={itemForm.unit} onValueChange={v => setItemForm(p => ({ ...p, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">Unidade</SelectItem>
                    <SelectItem value="m">Metro</SelectItem>
                    <SelectItem value="m2">m²</SelectItem>
                    <SelectItem value="kg">Kg</SelectItem>
                    <SelectItem value="l">Litro</SelectItem>
                    <SelectItem value="pç">Peça</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Mínimo</Label><Input type="number" value={itemForm.minimum_stock} onChange={e => setItemForm(p => ({ ...p, minimum_stock: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Qtd Fabril</Label><Input type="number" value={itemForm.quantity_factory} onChange={e => setItemForm(p => ({ ...p, quantity_factory: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Qtd Superior</Label><Input type="number" value={itemForm.quantity_upper} onChange={e => setItemForm(p => ({ ...p, quantity_upper: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowItemForm(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Request Form Dialog */}
      <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Solicitação de Material</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createRequestMutation.mutate(reqForm); }} className="space-y-4">
            <div>
              <Label>Item *</Label>
              <Select value={reqForm.stock_item_id} onValueChange={v => {
                const item = items.find(i => i.id === v);
                setReqForm(p => ({ ...p, stock_item_id: v, item_name: item?.name || "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.code} - {i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Quantidade *</Label><Input type="number" min={1} value={reqForm.quantity_requested} onChange={e => setReqForm(p => ({ ...p, quantity_requested: parseInt(e.target.value) || 1 }))} /></div>
              <div>
                <Label>De qual estoque *</Label>
                <Select value={reqForm.from_stock} onValueChange={v => setReqForm(p => ({ ...p, from_stock: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fabril">Estoque Fabril</SelectItem>
                    <SelectItem value="superior">Estoque Superior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Setor solicitante</Label><Input value={reqForm.sector} onChange={e => setReqForm(p => ({ ...p, sector: e.target.value }))} /></div>
            <div><Label>Observações</Label><Input value={reqForm.observations} onChange={e => setReqForm(p => ({ ...p, observations: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowRequestForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={!reqForm.stock_item_id}>Solicitar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}