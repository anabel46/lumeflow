import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UserCog, Plus, Pencil, Trash2, Search, ShieldCheck,
  Lock, Eye, EyeOff, User, Users, KeyRound
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTORS } from "@/lib/constants";

const ROLES = [
  { value: "admin", label: "Administrador", desc: "Acesso total ao sistema", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "gerente", label: "Gerente", desc: "Acesso a todos os módulos exceto administração", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "operador_setor", label: "Operador de Setor", desc: "Acesso apenas ao(s) setor(es) definidos", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "visualizador", label: "Visualizador", desc: "Acesso somente leitura aos módulos liberados", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

const MODULES = [
  { value: "dashboard", label: "Dashboard" },
  { value: "pedidos", label: "Pedidos" },
  { value: "producao", label: "Produção" },
  { value: "catalogo", label: "Catálogo" },
  { value: "estoque", label: "Estoque" },
  { value: "qualidade", label: "Qualidade" },
  { value: "sac", label: "SAC" },
  { value: "relatorios", label: "Relatórios" },
];

const EMPTY_FORM = {
  name: "",
  cpf: "",
  password_hash: "",
  role: "operador_setor",
  allowed_sectors: [],
  allowed_modules: [],
  active: true,
};

function formatCPF(v) {
  return v.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").slice(0, 14);
}

function RoleBadge({ role }) {
  const r = ROLES.find(r => r.value === role);
  if (!r) return null;
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md border", r.color)}>{r.label}</span>;
}

function UserFormDialog({ open, onClose, editing }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(editing || EMPTY_FORM);
  const [showPass, setShowPass] = useState(false);

  React.useEffect(() => {
    setForm(editing || EMPTY_FORM);
    setShowPass(false);
  }, [editing, open]);

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const toggleSector = (s) => {
    setForm(p => ({
      ...p,
      allowed_sectors: p.allowed_sectors?.includes(s)
        ? p.allowed_sectors.filter(x => x !== s)
        : [...(p.allowed_sectors || []), s],
    }));
  };

  const toggleModule = (m) => {
    setForm(p => ({
      ...p,
      allowed_modules: p.allowed_modules?.includes(m)
        ? p.allowed_modules.filter(x => x !== m)
        : [...(p.allowed_modules || []), m],
    }));
  };

  const saveMutation = useMutation({
    mutationFn: (data) => editing?.id
      ? base44.entities.SystemUser.update(editing.id, data)
      : base44.entities.SystemUser.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-users"] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const showSectors = form.role === "operador_setor";
  const showModules = form.role === "visualizador" || form.role === "gerente";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-4 h-4" />
            {editing ? "Editar Usuário" : "Novo Usuário"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome Completo *</Label>
              <Input
                className="mt-1"
                placeholder="Nome do operador"
                value={form.name}
                onChange={e => setField("name", e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs">CPF (login) *</Label>
              <div className="relative mt-1">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={e => setField("cpf", formatCPF(e.target.value))}
                  required
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Senha *</Label>
              <div className="relative mt-1">
                <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 pr-9"
                  type={showPass ? "text" : "password"}
                  placeholder="Senha de acesso"
                  value={form.password_hash}
                  onChange={e => setField("password_hash", e.target.value)}
                  required={!editing}
                />
                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass(p => !p)}>
                  {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {editing && <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para manter a senha atual</p>}
            </div>
            <div>
              <Label className="text-xs">Perfil de Acesso *</Label>
              <Select value={form.role} onValueChange={v => setField("role", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <p className="font-medium">{r.label}</p>
                        <p className="text-[11px] text-muted-foreground">{r.desc}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sector selection for operador_setor */}
          {showSectors && (
            <div className="border rounded-xl p-4">
              <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                Setores Permitidos
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SECTORS.map(s => (
                  <label key={s.id} className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm",
                    form.allowed_sectors?.includes(s.id)
                      ? "bg-blue-50 border-blue-300 text-blue-800"
                      : "bg-muted/30 border-border hover:bg-muted/60"
                  )}>
                    <Checkbox
                      checked={!!form.allowed_sectors?.includes(s.id)}
                      onCheckedChange={() => toggleSector(s.id)}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Module selection for gerente/visualizador */}
          {showModules && (
            <div className="border rounded-xl p-4">
              <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-purple-600" />
                Módulos Permitidos {form.role === "gerente" && <span className="text-muted-foreground font-normal">(todos por padrão se nenhum selecionado)</span>}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MODULES.map(m => (
                  <label key={m.value} className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm",
                    form.allowed_modules?.includes(m.value)
                      ? "bg-purple-50 border-purple-300 text-purple-800"
                      : "bg-muted/30 border-border hover:bg-muted/60"
                  )}>
                    <Checkbox
                      checked={!!form.allowed_modules?.includes(m.value)}
                      onCheckedChange={() => toggleModule(m.value)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Active toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={!!form.active} onCheckedChange={v => setField("active", !!v)} />
            <span className="text-sm">Usuário ativo</span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editing ? "Salvar Alterações" : "Criar Usuário"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Administration() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["system-users"],
    queryFn: () => base44.entities.SystemUser.list("name", 500),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SystemUser.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["system-users"] }),
  });

  const filtered = users.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.cpf?.includes(search)
  );

  const handleEdit = (u) => { setEditing(u); setFormOpen(true); };
  const handleNew = () => { setEditing(null); setFormOpen(true); };
  const handleClose = () => { setFormOpen(false); setEditing(null); };

  const roleCount = (role) => users.filter(u => u.role === role).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="w-6 h-6 text-primary" />
            Administração
          </h1>
          <p className="text-sm text-muted-foreground">Cadastro de usuários e controle de acesso</p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Usuário
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ROLES.map(r => (
          <div key={r.value} className="bg-card border rounded-xl px-4 py-3 flex items-center gap-3">
            <Users className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-lg font-bold">{roleCount(r.value)}</p>
              <p className="text-xs text-muted-foreground">{r.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
        <div>
          <strong>Como funciona o acesso:</strong> Operadores de setor fazem login com CPF e senha e só enxergam o(s) setor(es) liberados.
          Gerentes têm acesso completo (exceto Administração). Administradores têm acesso total.
          O controle é feito pelo campo <strong>Perfil de Acesso</strong> de cada usuário cadastrado aqui.
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* User list */}
      {isLoading ? (
        <div className="text-center p-10 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border rounded-2xl p-10 text-center text-muted-foreground">
          {users.length === 0 ? "Nenhum usuário cadastrado. Clique em \"Novo Usuário\" para começar." : "Nenhum usuário encontrado."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <div key={u.id} className={cn(
              "bg-card border rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap",
              !u.active && "opacity-50"
            )}>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{u.name}</p>
                  {!u.active && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inativo</Badge>}
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-xs text-muted-foreground font-mono">{u.cpf || "—"}</span>
                  <RoleBadge role={u.role} />
                  {u.role === "operador_setor" && u.allowed_sectors?.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      Setores: {u.allowed_sectors.join(", ")}
                    </span>
                  )}
                  {u.role === "visualizador" && u.allowed_modules?.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      Módulos: {u.allowed_modules.join(", ")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(u)} className="h-8 w-8 p-0">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { if (confirm(`Remover ${u.name}?`)) deleteMutation.mutate(u.id); }}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <UserFormDialog open={formOpen} onClose={handleClose} editing={editing} />
    </div>
  );
}