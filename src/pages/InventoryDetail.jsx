import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Package, CheckCircle2, AlertTriangle, Clock, Archive,
  Search, Plus, Save, Send, Check, TrendingUp, FileText, Database
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import InventorySummary from "@/components/inventory/InventorySummary";
import SyncSankhyaModal from "@/components/inventory/SyncSankhyaModal";

const STATUS_CONFIG = {
  pendente: { label: "Pendente", color: "bg-slate-100 text-slate-600 border-slate-200" },
  contado: { label: "Contado", color: "bg-blue-100 text-blue-700 border-blue-200" },
  ok: { label: "OK", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  divergente: { label: "Divergente", color: "bg-amber-100 text-amber-700 border-amber-200" },
  ajustado: { label: "Ajustado", color: "bg-purple-100 text-purple-700 border-purple-200" },
};

const SESSION_STATUS_CONFIG = {
  rascunho: { label: "Rascunho", color: "bg-slate-100 text-slate-700" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-100 text-blue-700" },
  aguardando_aprovacao: { label: "Aguardando Aprovação", color: "bg-amber-100 text-amber-700" },
  aprovado: { label: "Aprovado", color: "bg-emerald-100 text-emerald-700" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

const CATEGORIES = [
  "Elétrico",
  "Cúpulas",
  "Alumínio",
  "Acessórios",
  "EPI e Cabos",
  "Gesso e Fundição",
  "Vidros e Madeiras",
  "Embalagem",
  "Outros",
];

// Dados de exemplo para pré-popular
const SAMPLE_ITEMS = [
  { item_code: "EPI-025A", item_name: "AVENTAL BARBEIRO", quantity_current: 2, address: "F1-P001-A1", category: "EPI e Cabos" },
  { item_code: "110.240.950", item_name: "LÂMPADA LED 950lm", quantity_current: 45, address: "D1-P003-A2", category: "Elétrico" },
  { item_code: "220.901.460-01", item_name: "CÚPULA LINHO OFFWHITE 460mm", quantity_current: 8, address: "D1-P007-A1", category: "Cúpulas" },
  { item_code: "410.001.015", item_name: "BUCHA ALUMÍNIO 15mm", quantity_current: 120, address: "D1-P002-A3", category: "Alumínio" },
  { item_code: "930.050.M6", item_name: "PARAFUSO M6 INOX", quantity_current: 0, address: "D1-P010-A2", category: "Acessórios" },
  { item_code: "170.899.137", item_name: "DRIVER LED 137W", quantity_current: 12, address: "D1-P005-A1", category: "Elétrico" },
];

export default function InventoryDetail() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [editedItems, setEditedItems] = useState({});

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["inventory-session", sessionId],
    queryFn: () => base44.entities.InventorySession.get(sessionId),
  });

  const { data: counts = [], isLoading: countsLoading } = useQuery({
    queryKey: ["inventory-counts", sessionId],
    queryFn: () => base44.entities.InventoryCount.filter({ session_id: sessionId }),
  });

  // Pré-popular com itens de exemplo se não houver contagens
  const itemsToDisplay = useMemo(() => {
    if (counts.length > 0) return counts;
    if (!session || session.status !== "em_andamento") return [];
    
    // Criar itens de exemplo apenas na primeira vez
    return SAMPLE_ITEMS.map((sample, idx) => ({
      id: `sample-${idx}`,
      session_id: sessionId,
      ...sample,
      quantity_revised: null,
      status: "pendente",
      address_updated: false,
      category_updated: false,
    }));
  }, [counts, session, sessionId]);

  const filteredItems = useMemo(() => {
    return itemsToDisplay.filter(item => {
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!item.item_code?.toLowerCase().includes(s) &&
            !item.item_name?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [itemsToDisplay, search, filterStatus]);

  const stats = useMemo(() => {
    const total = itemsToDisplay.length;
    const counted = itemsToDisplay.filter(i => i.status !== "pendente").length;
    const ok = itemsToDisplay.filter(i => i.status === "ok").length;
    const divergent = itemsToDisplay.filter(i => i.status === "divergente").length;
    const pending = total - counted;
    return { total, counted, ok, divergent, pending };
  }, [itemsToDisplay]);

  const updateCountMutation = useMutation({
    mutationFn: async ({ itemId, data }) => {
      if (itemId.startsWith("sample-")) {
        // Para itens de exemplo, apenas atualiza o estado local
        setEditedItems(prev => ({ ...prev, [itemId]: data }));
        return { id: itemId, ...data };
      }
      return base44.entities.InventoryCount.update(itemId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-counts", sessionId] });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.InventorySession.update(sessionId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-session", sessionId] });
    },
  });

  const handleQuantityChange = (item, value) => {
    const qtdAtual = item.quantity_current || 0;
    const qtdRevisada = value === "" ? null : Number(value);
    
    let newStatus = "pendente";
    if (qtdRevisada !== null && qtdRevisada !== undefined) {
      newStatus = qtdRevisada === qtdAtual ? "ok" : "divergente";
    }

    updateCountMutation.mutate({
      itemId: item.id,
      data: {
        quantity_revised: qtdRevisada,
        status: newStatus,
        counted_at: new Date().toISOString(),
      },
    });
  };

  const handleAddressChange = (item, value) => {
    updateCountMutation.mutate({
      itemId: item.id,
      data: {
        address: value,
        address_updated: value !== item.address,
      },
    });
  };

  const handleCategoryChange = (item, value) => {
    updateCountMutation.mutate({
      itemId: item.id,
      data: {
        category: value,
        category_updated: value !== item.category,
      },
    });
  };

  const handleSaveDraft = () => {
    updateSessionMutation.mutate({
      status: "rascunho",
      finished_at: new Date().toISOString(),
    });
    toast.success("Rascunho salvo com sucesso!");
    navigate("/inventario");
  };

  const handleSendForApproval = () => {
    if (stats.counted === 0) {
      toast.error("Conte pelo menos 1 item antes de enviar para aprovação");
      return;
    }
    updateSessionMutation.mutate({
      status: "aguardando_aprovacao",
      finished_at: new Date().toISOString(),
    });
    toast.success("Enviado para aprovação!");
    navigate("/inventario");
  };

  const handleApprove = () => {
    updateSessionMutation.mutate({
      status: "aprovado",
      approved_at: new Date().toISOString(),
      // approved_by será preenchido automaticamente pelo backend ou usuário atual
    });
    toast.success("Inventário aprovado!");
  };

  const handleSyncSankhya = () => {
    setShowSyncModal(true);
  };

  if (sessionLoading || countsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-4">Carregando inventário...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-semibold mb-2">Sessão não encontrada</h2>
        <Button onClick={() => navigate("/inventario")}>Voltar para Inventário</Button>
      </div>
    );
  }

  const canEdit = session.status === "em_andamento";
  const canApprove = session.status === "aguardando_aprovacao";
  const canSync = session.status === "aprovado" && session.sankhya_sync_status !== "sincronizado";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/inventario")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{session.title}</h1>
            <p className="text-sm text-muted-foreground">
              Responsável: {session.responsible} • {session.stock_group}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={cn("text-sm px-3 py-1", SESSION_STATUS_CONFIG[session.status]?.color)}>
          {SESSION_STATUS_CONFIG[session.status]?.label}
        </Badge>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <span className="font-medium">Progresso da Contagem</span>
            </div>
            <span className="text-sm font-medium">{stats.counted} de {stats.total} itens</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${stats.total > 0 ? (stats.counted / stats.total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{stats.pending} pendentes</span>
            <span>{stats.ok} OK</span>
            {stats.divergent > 0 && (
              <span className="text-amber-600 font-medium">{stats.divergent} divergentes</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {canEdit && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveDraft} className="gap-2">
            <Save className="w-4 h-4" /> Salvar Rascunho
          </Button>
          <Button onClick={handleSendForApproval} className="gap-2" disabled={stats.counted === 0}>
            <Send className="w-4 h-4" /> Enviar para Aprovação
          </Button>
        </div>
      )}

      {canApprove && (
        <Button onClick={handleApprove} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Check className="w-4 h-4" /> Aprovar Inventário
        </Button>
      )}

      {canSync && (
        <Button onClick={handleSyncSankhya} variant="outline" className="gap-2">
          <Database className="w-4 h-4" /> Sincronizar com Sankhya
        </Button>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou nome..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-9 px-3 rounded-lg border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="ok">OK</option>
          <option value="divergente">Divergente</option>
        </select>
      </div>

      {/* Items Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3 font-semibold">CÓDIGO</th>
                <th className="text-left p-3 font-semibold">NOME DO ITEM</th>
                <th className="text-center p-3 font-semibold">QTD. ATUAL</th>
                <th className="text-center p-3 font-semibold">QTD. REVISADA</th>
                <th className="text-center p-3 font-semibold">ENDEREÇO</th>
                <th className="text-center p-3 font-semibold">CATEGORIA</th>
                <th className="text-center p-3 font-semibold">STATUS</th>
                {canEdit && <th className="text-center p-3 font-semibold">AÇÕES</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-8 text-muted-foreground">
                    Nenhum item encontrado
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const editedData = editedItems[item.id] || {};
                  const quantityRevised = editedData.quantity_revised ?? item.quantity_revised;
                  const status = editedData.status ?? item.status;
                  const isDivergent = status === "divergente";

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b hover:bg-muted/30 transition-colors",
                        isDivergent && "bg-amber-50/50"
                      )}
                    >
                      <td className="p-3 font-mono font-medium">{item.item_code}</td>
                      <td className="p-3">{item.item_name}</td>
                      <td className="p-3 text-center font-medium">{item.quantity_current}</td>
                      <td className="p-3">
                        {canEdit ? (
                          <Input
                            type="number"
                            className={cn(
                              "h-8 text-center",
                              isDivergent && "border-amber-400 bg-amber-50"
                            )}
                            value={quantityRevised ?? ""}
                            onChange={(e) => handleQuantityChange(item, e.target.value)}
                            placeholder="-"
                          />
                        ) : (
                          <span className="font-medium">{quantityRevised ?? "-"}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {canEdit ? (
                          <Input
                            className="h-8 text-center text-xs"
                            value={editedData.address ?? item.address ?? ""}
                            onChange={(e) => handleAddressChange(item, e.target.value)}
                            placeholder="Endereço"
                          />
                        ) : (
                          <span className="text-xs">{item.address || "-"}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {canEdit ? (
                          <select
                            className="h-8 px-2 rounded border border-input bg-transparent text-xs text-center"
                            value={editedData.category ?? item.category ?? ""}
                            onChange={(e) => handleCategoryChange(item, e.target.value)}
                          >
                            <option value="">-</option>
                            {CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs">{item.category || "-"}</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={cn("text-[10px]", STATUS_CONFIG[status]?.color)}>
                          {STATUS_CONFIG[status]?.label}
                        </Badge>
                      </td>
                      {canEdit && (
                        <td className="p-3 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              updateCountMutation.mutate({
                                itemId: item.id,
                                data: {
                                  counted_by: "Operador",
                                  counted_at: new Date().toISOString(),
                                },
                              });
                              toast.success("Item confirmado!");
                            }}
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Panel */}
      <InventorySummary
        items={itemsToDisplay}
        stats={stats}
        session={session}
      />

      <SyncSankhyaModal
        open={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        session={session}
        divergentItems={itemsToDisplay.filter(i => i.status === "divergente")}
      />
    </div>
  );
}