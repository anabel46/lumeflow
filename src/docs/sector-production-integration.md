# Integração Setores ↔ Produção

## Objetivo
Sincronizar em tempo real as ações executadas nos setores com a tela de Produção, atualizando o status das OPs, progresso e etapas.

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
User executa ação em SectorView
  ↓
ProductionOrder entity é atualizada
  ↓
Subscrição de mudanças dispara (base44.entities.ProductionOrder.subscribe)
  ↓
Hook useSectorProductionIntegration() é acionado
  ↓
Cache de Production page é invalidado
  ↓
Dashboard-sankhya é recalculado (refetch)
  ↓
Tela de Produção atualiza em tempo real
```

### 2. Polling Automático (Fallback)
Além da subscrição em tempo real, a tela de Produção faz polling a cada **15 segundos**:
```javascript
refetchInterval: 15000  // em useQuery
useProductionSync(15000) // hook dedicado
```

## Comportamento por Ação

### Iniciar (em SectorView)
```
sector_status = "em_producao"
status = "em_producao"
sector_started_at = novo timestamp
  ↓ 
[Produção] Etapa muda para "Em andamento" (badge azul)
[Produção] Contador de OPs produzindo aumenta
```

### Pausar
```
sector_status = "aguardando" (regressa ao estado anterior)
status = "em_producao"
  ↓ 
[Produção] Etapa volta para "Aguardando" (badge amarelo)
[Produção] Barra de progresso mantém-se
```

### Concluir
```
current_step_index += 1
current_sector = production_sequence[current_step_index]
sector_status = "concluido"
finished_at = novo timestamp
  ↓ 
[Produção] Etapa atual avança
[Produção] Barra de progresso sobe (ex: 33% → 66%)
[Produção] Próxima etapa é desbloqueada
[Produção] Se última etapa → Status "Finalizado" (badge verde)
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

## Próximos Passos

- [ ] Adicionar notificações toast ao completar OP
- [ ] Histórico completo de mudanças por OP
- [ ] Gráficos de tempo médio por setor
- [ ] Alertas de OPs atrasadas em tempo real