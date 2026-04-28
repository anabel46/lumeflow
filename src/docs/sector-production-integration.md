# Integração Setores ↔ Produção

## Objetivo
Sincronizar em tempo real as ações executadas nos setores com a tela de Produção, atualizando o status das OPs, progresso e etapas.

## ⚠️ Garantias (Tela de Produção)
- ✅ Formatação visual **não é alterada**
- ✅ Número da OP continua sendo exibido exatamente como já está
- ✅ Nenhum campo existente é sobrescrito ou reprocessado
- ✅ Queries de dados não são modificadas
- ✅ Apenas uma camada de **sincronização de status** é adicionada
- ✅ Polling automático de 15s garante atualização sem reload

## Mapeamento Setor → Etapa do Kanban

```
SETORES → ETAPAS (Tela de Produção)
┌─────────────────────────────────────────┐
│ Estamparia          → ESTAMPARIA        │
│ Tornearia           → TORNEARIA         │
│ Corte               → CORTE             │
│ Solda               → SOLDA             │
│ Lixa                → LIXA              │
│ Repuxo              → REPUXO            │
│ Pintura             → PINTURA           │
│ Montagem Decorativa → MONTAGEM          │
│ Montagem Elétrica   → MONTAGEM          │
│ Montagem Perfil     → MONTAGEM          │
│ Montagem Embutidos  → MONTAGEM          │
│ Controle Qualidade  → CONTROLE_QUALIDADE│
│ Embalagem           → EMBALAGEM         │
│ Mesa Barra          → ENTREGA           │
│ Mesa Ipanema        → ENTREGA           │
│ Mesa São Gabriel    → ENTREGA           │
│ Mesa Vila Madalena  → ENTREGA           │
│ Mesa Fábrica        → ENTREGA           │
│ Agendamento         → AGENDAMENTO       │
│ Expedição           → SEPARACAO         │
└─────────────────────────────────────────┘
```

Configurado em: `lib/constants.js` → `SECTOR_TO_STAGE`

## Fluxo de Sincronização

### 1. Ação no Setor → Atualização da OP

```
User clica em Iniciar/Pausar/Concluir em SectorView
  ↓
SectorView chama logSectorAction() backend
  ↓
logSectorAction() registra em SectorLog + atualiza ProductionOrder
  (apenas campos: current_sector, sector_status, sector_started_at, finished_at)
  ↓
Subscrição ProductionOrder.subscribe() dispara
  ↓
Cache "dashboard-sankhya" é invalidado
  ↓
Production page refetch automaticamente
  ↓
Dashboard recalcula com dados atualizados (SEM reformatação)
  ↓
Tela de Produção atualiza em tempo real
```

**Importante:** Dados visualizados (número OP, produto, campos) **nunca são reformatados ou reprocessados**. Apenas o cache é invalidado e refetch dos dados originais ocorre.

### 2. Polling Automático (Fallback)
Além da subscrição em tempo real, a tela de Produção faz polling a cada **15 segundos**:
```javascript
refetchInterval: 15000  // em useQuery
useProductionSync(15000) // hook dedicado
```

## Comportamento por Ação

### Iniciar (Clique em "Iniciar" em SectorView)
```javascript
// logSectorAction() atualiza:
{
  current_sector: "estamparia",
  sector_status: "em_producao",
  sector_started_at: ISO timestamp
}

// SectorLog registra:
{
  action: "entrada",
  operator: "João Silva",
  timestamp: ISO
}

// Resultado na Produção:
// Dashboard recalcula apenas o status dessa OP
// Exibição permanece idêntica (sem reformatação)
```

### Pausar (Clique em "Pausar" em SectorView)
```javascript
// logSectorAction() atualiza:
{
  current_sector: "estamparia",
  sector_status: "aguardando"
}

// SectorLog registra:
{
  action: "retrabalho",
  observations: "Ajuste necessário"
}

// Resultado na Produção:
// Status retorna ao anterior
// Exibição e dados não mudam
```

### Concluir (Clique em "Concluir" em SectorView)
```javascript
// logSectorAction() atualiza:
{
  current_sector: próximo setor,
  sector_status: "concluido",
  finished_at: ISO timestamp
}

// SectorLog registra:
{
  action: "saida",
  operator: "João Silva"
}

// Resultado na Produção:
// Etapa marca como concluída
// Próxima etapa desbloqueada
// Barra progresso avança
// OP permanece visível até todas etapas finalizarem
// Formatação visual não muda
```

## Campos Monitorados na ProductionOrder

```javascript
{
  id: string,
  unique_number: string,        // OP-46100
  order_number: string,         // #1234
  product_name: string,
  quantity: number,
  current_sector: string,       // setor atual (ex: "estamparia")
  current_step_index: number,   // índice na production_sequence
  sector_status: string,        // "aguardando" | "em_producao" | "concluido"
  status: string,               // "planejamento" | "em_producao" | "finalizado"
  production_sequence: string[], // ["estamparia", "tornearia", "pintura", ...]
  sector_started_at: ISO,
  finished_at: ISO,
  delivery_deadline: date,
  purchase_location: string,
}
```

## Hooks Utilizados

### `useProductionSync(pollingInterval)`
**Localização:** `hooks/useProductionSync.js`

Setup automático de:
- Polling de 15s via `refetchInterval`
- Subscrição em tempo real a mudanças de ProductionOrder
- Invalidação de cache ao detectar mudanças

**Uso:**
```javascript
useProductionSync(15000); // já configurado em pages/Production
```

### `useSectorProductionIntegration()`
**Localização:** `hooks/useSectorProductionIntegration.js`

Monitora mudanças em ProductionOrder e sincroniza cache:
- Atualiza cache local imediatamente
- Invalida queries relacionadas
- Força recalcul de estatísticas

**Uso:**
```javascript
useSectorProductionIntegration(); // já configurado em pages/Production
```

## Persistência de Ações

Cada ação em um setor cria um log em `SectorLog`:
```javascript
{
  production_order_id: string,
  unique_number: string,
  sector: string,
  action: "entrada" | "saida" | "retrabalho",
  operator: string,
  observations: string,
  started_at: ISO,
  finished_at: ISO,
  timestamp: ISO,
  rating: number (1-5)
}
```

## Testes de Sincronização

1. **Abrir ambas as telas lado a lado**
   - `Production` (esquerda)
   - `SectorView` de qualquer setor (direita)

2. **Executar ação em SectorView**
   - Clicar "Iniciar" em uma OP
   - Esperar até 15s ou observe atualização automática

3. **Verificar atualização em Production**
   - Badge da etapa muda cor (amarelo → azul)
   - Contador de "produzindo" aumenta
   - Barra de progresso reflete progresso

4. **Concluir OP em SectorView**
   - Clicar "Concluir"
   - Verificar em Production: progresso avança, próxima etapa desbloqueada

## Limite de Rate Limit

O polling pode estar sujeito a rate limits da API. Se houver muitos acessos simultâneos:
- Aumentar `pollingInterval` de 15s para 30s
- Usar subscrição em tempo real apenas (desativar polling)

Configurável em:
```javascript
// pages/Production.tsx
useProductionSync(30000); // aumentar para 30s
```

## Implementação Garantida

### O que **NÃO** muda na tela de Produção:
- ❌ Formatação visual de OPs
- ❌ Número da OP (exibição)
- ❌ Produto, referência, campos de ordem
- ❌ Queries de busca de dados
- ❌ Lógica de agrupamento por pedido
- ❌ Estrutura de cards ou tabelas

### O que **MUDA** apenas:
- ✅ Status de cada etapa (via `sector_status`)
- ✅ Ordem de prioridade no kanban (refetch automático)
- ✅ Barra de progresso (recalcul de completes)
- ✅ Visibilidade da OP (quando todas etapas = finalizado)

### Fluxo Técnico Seguro:
1. `logSectorAction()` backend registra ação + atualiza ProductionOrder
2. Subscrição em tempo real invalida cache
3. Production page refetch dados do getDashboard
4. Dados são processados **exatamente como antes** (nenhuma mudança)
5. Dashboard renderiza com dados atualizados (exibição mantida)

## Próximos Passos

- [ ] Adicionar notificações toast ao completar OP
- [ ] Histórico completo de mudanças por OP
- [ ] Gráficos de tempo médio por setor
- [ ] Alertas de OPs atrasadas em tempo real