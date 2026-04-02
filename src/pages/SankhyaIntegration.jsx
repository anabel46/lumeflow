import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  RefreshCw, ArrowDownCircle, ArrowUpCircle, CheckCircle2,
  XCircle, AlertTriangle, Clock, Wifi, WifiOff, Play, ArrowLeftRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// URL do serviço de integração — ajuste via variável de ambiente no Vite
const BRIDGE_URL = import.meta.env.VITE_SANKHYA_BRIDGE_URL || "http://localhost:3001";

function useBridgeStatus(refreshInterval = 10000) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(null);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      const [healthRes, syncRes] = await Promise.all([
        window.fetch(`${BRIDGE_URL}/health`),
        window.fetch(`${BRIDGE_URL}/sync/status`),
      ]);
      const health = await healthRes.json();
      const syncStatus = await syncRes.json();
      setStatus({ health, sync: syncStatus });
      setOnline(true);
      setError(null);
    } catch (err) {
      setOnline(false);
      setError("Serviço de integração inacessível.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, refreshInterval);
    return () => clearInterval(id);
  }, [fetch, refreshInterval]);

  return { status, loading, online, error, refresh: fetch };
}

function StatCard({ title, value, icon: Icon, color = "blue" }) {
  const colors = {
    blue: "text-blue-600 bg-blue-50",
    green: "text-green-600 bg-green-50",
    orange: "text-orange-600 bg-orange-50",
    red: "text-red-600 bg-red-50",
  };
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-xl ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value ?? "—"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SyncResultCard({ title, result, direction }) {
  if (!result) return null;

  const isOk = !result.errors || result.errors.length === 0;

  return (
    <Card className={`border-l-4 ${isOk ? "border-l-green-400" : "border-l-amber-400"}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <Badge variant={isOk ? "default" : "destructive"} className="text-xs">
            {isOk ? "OK" : `${result.errors?.length} erro(s)`}
          </Badge>
        </div>
        {result.lastRun && (
          <CardDescription className="text-xs">
            Última execução:{" "}
            {format(new Date(result.lastRun), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
          </CardDescription>
        )}
      </CardHeader>
      {result.lastResult && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {direction === "pull" && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Sankhya:</span>
                  <span className="font-medium">{result.lastResult.total ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criados:</span>
                  <span className="font-medium text-green-600">{result.lastResult.created ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Atualizados:</span>
                  <span className="font-medium text-blue-600">{result.lastResult.updated ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ignorados:</span>
                  <span className="font-medium">{result.lastResult.skipped ?? 0}</span>
                </div>
              </>
            )}
            {direction === "push" && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">OPs criadas:</span>
                  <span className="font-medium text-green-600">{result.lastResult.created ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status atualizados:</span>
                  <span className="font-medium text-blue-600">{result.lastResult.statusUpdated ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ignoradas:</span>
                  <span className="font-medium">{result.lastResult.skipped ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Erros:</span>
                  <span className={`font-medium ${result.lastResult.errors?.length ? "text-red-600" : ""}`}>
                    {result.lastResult.errors?.length ?? 0}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Erros detalhados */}
          {result.lastResult.errors?.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-semibold text-red-600">Erros:</p>
              {result.lastResult.errors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-xs text-red-500 bg-red-50 rounded px-2 py-1">
                  {e.op || e.nunota ? `[${e.op || `NUNOTA=${e.nunota}`}] ` : ""}{e.error}
                </p>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-2">
            Duração: {result.lastResult.durationMs}ms
          </p>
        </CardContent>
      )}
    </Card>
  );
}

export default function SankhyaIntegration() {
  const { status, loading, online, error, refresh } = useBridgeStatus(15000);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionResult, setActionResult] = useState(null);

  async function triggerSync(type) {
    setActionLoading(type);
    setActionResult(null);
    try {
      const res = await window.fetch(`${BRIDGE_URL}/sync/${type}`, { method: "POST" });
      const data = await res.json();
      setActionResult({ type, ok: data.ok, data });
      await refresh();
    } catch (err) {
      setActionResult({ type, ok: false, error: err.message });
    } finally {
      setActionLoading(null);
    }
  }

  const sync = status?.sync;
  const isSyncing = sync?.isSyncing || actionLoading !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Integração Sankhya</h1>
          <p className="text-sm text-muted-foreground">
            Sincronização bidirecional entre LumeFlow e ERP Sankhya
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2 self-start">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Status do serviço */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            {online === null ? (
              <Clock className="w-5 h-5 text-muted-foreground animate-pulse" />
            ) : online ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            <div>
              <p className="font-medium text-sm">
                {online === null
                  ? "Verificando serviço..."
                  : online
                  ? "Serviço de integração online"
                  : "Serviço de integração offline"}
              </p>
              {online && status?.health && (
                <p className="text-xs text-muted-foreground">
                  Uptime: {Math.floor(status.health.uptime / 60)} min | URL: {BRIDGE_URL}
                </p>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            {online && isSyncing && (
              <Badge variant="secondary" className="ml-auto gap-1 text-xs">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Sincronizando...
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fluxo de comunicação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="font-semibold text-blue-700">Sankhya ERP</p>
            <p className="text-xs text-muted-foreground">Pedidos aprovados (comercial)</p>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowDownCircle className="w-4 h-4 text-blue-500" />
            <span>Pedidos aprovados</span>
          </div>
          <ArrowLeftRight className="w-6 h-6 text-muted-foreground" />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowUpCircle className="w-4 h-4 text-green-500" />
            <span>Ordens de fabricação</span>
          </div>
        </div>

        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="font-semibold text-green-700">LumeFlow</p>
            <p className="text-xs text-muted-foreground">Ordens de produção (fábrica)</p>
          </CardContent>
        </Card>
      </div>

      {/* Resultados da última sync */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SyncResultCard
          title="Sankhya → LumeFlow (Pull)"
          result={sync?.pull}
          direction="pull"
        />
        <SyncResultCard
          title="LumeFlow → Sankhya (Push)"
          result={sync?.push}
          direction="push"
        />
      </div>

      {/* Ações manuais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sincronização Manual</CardTitle>
          <CardDescription>
            A sincronização ocorre automaticamente. Use os botões abaixo para forçar uma execução imediata.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={!online || isSyncing}
            onClick={() => triggerSync("pull")}
            className="gap-2"
          >
            {actionLoading === "pull" ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowDownCircle className="w-4 h-4 text-blue-500" />
            )}
            Buscar Pedidos (Sankhya → Lume)
          </Button>

          <Button
            variant="outline"
            disabled={!online || isSyncing}
            onClick={() => triggerSync("push")}
            className="gap-2"
          >
            {actionLoading === "push" ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUpCircle className="w-4 h-4 text-green-500" />
            )}
            Enviar OPs (Lume → Sankhya)
          </Button>

          <Button
            disabled={!online || isSyncing}
            onClick={() => triggerSync("full")}
            className="gap-2"
          >
            {actionLoading === "full" ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Sincronização Completa
          </Button>
        </CardContent>
      </Card>

      {/* Resultado da ação disparada */}
      {actionResult && (
        <Card className={`border-l-4 ${actionResult.ok ? "border-l-green-400" : "border-l-red-400"}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              {actionResult.ok ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <p className="font-medium text-sm">
                {actionResult.ok
                  ? `Sincronização "${actionResult.type}" concluída com sucesso.`
                  : `Erro: ${actionResult.error || "Falha na sincronização."}`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instruções de configuração */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Configuração do Serviço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Para ativar a integração, configure e execute o serviço backend:</p>
          <ol className="list-decimal list-inside space-y-1 pl-2">
            <li>Copie <code className="bg-muted px-1 rounded">backend/.env.example</code> para <code className="bg-muted px-1 rounded">backend/.env</code></li>
            <li>Preencha as credenciais Sankhya e Base44</li>
            <li>Execute <code className="bg-muted px-1 rounded">cd backend && npm install && npm start</code></li>
            <li>Adicione <code className="bg-muted px-1 rounded">VITE_SANKHYA_BRIDGE_URL</code> no <code className="bg-muted px-1 rounded">.env</code> do frontend</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
