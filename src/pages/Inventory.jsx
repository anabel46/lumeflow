import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Filter, Package, CheckCircle2, AlertTriangle, Clock, Archive } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import CreateSessionDialog from "@/components/inventory/CreateSessionDialog";

const STATUS_CONFIG = {
  rascunho: { label: "Rascunho", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock },
  em_andamento: { label: "Em Andamento", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Package },
  aguardando_aprovacao: { label: "Aguardando Aprovação", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  aprovado: { label: "Aprovado", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700 border-red-200", icon: Archive },
};

const GROUP_LABELS = {
  importado: "Importado",
  revenda_china: "Revenda China",
  revenda_brasil: "Revenda Brasil",
  mp_nacional: "MP Nacional",
  epi_cabos: "EPI e Cabos",
  gesso_fundicao: "Gesso e Fundição",
  vidros_madeiras: "Vidros e Madeiras",
  todos: "Todos",
};

export default function Inventory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["inventory-sessions"],
    queryFn: () => base44.entities.InventorySession.list("-created_date", 500),
  });

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      if (filterStatus !== "all" && session.status !== filterStatus) return false;
      if (filterGroup !== "all" && session.stock_group !== filterGroup) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!session.title?.toLowerCase().includes(s) &&
            !session.responsible?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [sessions, search, filterStatus, filterGroup]);

  const stats = useMemo(() => {
    return {
      total: sessions.length,
      em_andamento: sessions.filter(s => s.status === "em_andamento").length,
      aguardando: sessions.filter(s => s.status === "aguardando_aprovacao").length,
      aprovado: sessions.filter(s => s.status === "aprovado").length,
    };
  }, [sessions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventário</h1>
          <p className="text-sm text-muted-foreground">Gerenciar sessões de contagem de estoque</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Sessão
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total de sessões</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.em_andamento}</p>
                <p className="text-xs text-muted-foreground">Em andamento</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.aguardando}</p>
                <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.aprovado}</p>
                <p className="text-xs text-muted-foreground">Aprovadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou responsável..."
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
            <option value="rascunho">Rascunho</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="aguardando_aprovacao">Aguardando Aprovação</option>
            <option value="aprovado">Aprovado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <select
            className="h-9 px-3 rounded-lg border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
          >
            <option value="all">Todos os grupos</option>
            {Object.entries(GROUP_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">{filteredSessions.length} sessão(ões) encontrada(s)</p>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="text-center p-8 text-muted-foreground">Carregando...</div>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma sessão de inventário encontrada</p>
            <p className="text-xs mt-1">Crie uma nova sessão para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSessions.map((session) => (
            <Card
              key={session.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/inventario/${session.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-semibold line-clamp-2">{session.title}</CardTitle>
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_CONFIG[session.status]?.color)}>
                    {STATUS_CONFIG[session.status]?.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Grupo</span>
                    <span className="font-medium">{GROUP_LABELS[session.stock_group] || session.stock_group}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Responsável</span>
                    <span className="font-medium">{session.responsible}</span>
                  </div>
                  {session.started_at && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Início</span>
                      <span className="font-medium">{format(new Date(session.started_at), "dd/MM/yyyy")}</span>
                    </div>
                  )}
                </div>

                {/* Progress */}
                {(session.total_items > 0 || session.items_counted > 0) && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{session.items_counted || 0} / {session.total_items || 0}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${session.total_items > 0 ? ((session.items_counted || 0) / session.total_items) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Divergências */}
                {session.items_divergent > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1.5 rounded-lg">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="font-medium">{session.items_divergent} divergência(s)</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateSessionDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  );
}