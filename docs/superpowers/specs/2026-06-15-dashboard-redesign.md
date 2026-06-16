# Dashboard Redesign — sistemaMelo

**Data:** 2026-06-15  
**Status:** Aprovado para implementação

---

## Contexto

O dashboard atual exibe KPIs de vendas (leads, reuniões, faturamento) via um sistema de totais acumulados sem histórico temporal e sem gráficos. O redesign adiciona lançamento diário do SDR com gráficos históricos, filtro de período e um novo visual inspirado no padrão Mercado Livre.

---

## O que muda

### 1. Modelo de dados — novo: `SdrDailyLog`

Substituição do modelo de entrada atual (totais acumulados sem data) por um registro diário com timestamp.

**Campos:**
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | String (cuid) | PK |
| `date` | DateTime | Data do lançamento (único por dia — upsert) |
| `leadsWhatsapp` | Int | Leads que chegaram no WhatsApp |
| `agendadas` | Int | Reuniões agendadas pelo SDR |
| `realizadas` | Int | Reuniões efetivamente realizadas |
| `faltaLead` | Int | No-show — lead não compareceu |
| `naoRealizada` | Int | Não realizada — vendedor não conseguiu |
| `createdAt` | DateTime | Auto |
| `updatedAt` | DateTime | Auto |

**Regra:** uma entrada por data (upsert por `date`). O SDR pode atualizar o dia atual quantas vezes quiser; dias anteriores podem ser editados se necessário.

### 2. Modelo de dados — mantido: `DashboardMetric` e `DashboardGoal`

Os modelos de faturamento, vendas e metas **não mudam**. O sistema atual de add/edit de totais continua funcionando como está para vendas/faturamento.

---

## Layout geral

Estrutura de página (de cima para baixo):

```
[ Filtro de período ]  [ Comparar com ]         [ + Lançar dia ]
─────────────────────────────────────────────────────────────────
MÉTRICAS SDR — Reuniões & Leads
[ Leads WA ] [ Agendadas ] [ Realizadas ] [ Falta-lead ] [ N.Real. ]
─────────────────────────────────────────────────────────────────
VENDAS & FATURAMENTO
[ Faturamento ] [ Vendas ] [ Taxa lead→venda ] [ CAC ]
─────────────────────────────────────────────────────────────────
[ Funil de conversão ]     [ Evolução diária — gráfico de linha ]
─────────────────────────────────────────────────────────────────
[ Metas — Verde / Prata / Ouro ]
```

### Filtro de período

- Dropdown: "Este mês" (1º dia do mês até hoje), "Mês anterior" (mês completo anterior), "Últimos 30 dias", "Últimos 90 dias", "Personalizado" (date picker simples: data início + data fim)
- Dropdown "Comparar com": "Período anterior" (mesmo intervalo de dias imediatamente antes), "Sem comparação"
- Quando comparação ativa, cada KPI exibe `▲ X%` ou `▼ X%` vs período anterior
- Quando não há dados SDR para o período selecionado, KPIs exibem `0` (não ocultar os cards)

### Cards KPI

**Seção SDR** (borda esquerda azul `#6366f1`):
- Leads WhatsApp, Agendadas, Realizadas — borda azul
- Falta (lead), Não realizada — borda vermelha `#ef4444`

**Seção Vendas** (borda esquerda âmbar `#f59e0b`):
- Faturamento, Vendas fechadas, Taxa lead→venda, CAC médio

Cada card mostra: label, valor principal, delta vs comparação (verde/vermelho/neutro).

---

## Gráficos

### Funil de conversão (lado esquerdo)

Gráfico de barras horizontais mostrando o funil completo:
1. Leads WhatsApp (100% — base)
2. Agendadas (% de leads)
3. Realizadas (% de leads)
4. Vendas fechadas (% de leads)

Biblioteca: **Recharts** (já instalada ou a instalar — verificar). Alternativa: Tremor/shadcn charts.

### Evolução diária (lado direito)

Gráfico de linha multi-série com eixo X = datas do período selecionado:
- Série 1: Leads WhatsApp (azul `#6366f1`, linha contínua)
- Série 2: Agendadas (índigo claro `#818cf8`, linha tracejada)
- Série 3: Realizadas (verde `#10b981`, linha contínua)

Tooltip ao hover mostrando todos os valores daquele dia.

---

## Modal de lançamento diário (SDR)

Acionado pelo botão **"+ Lançar dia"** no canto superior direito.

**Comportamento:**
- Abre um modal centralizado com backdrop blur
- O título exibe a data atual formatada em PT-BR
- Se já houver lançamento para hoje, os campos são pré-preenchidos (modo edição)
- Ao salvar, faz upsert pelo campo `date`
- Validação: todos os campos são inteiros ≥ 0
- Após salvar, fecha o modal e revalida os dados do dashboard (recarrega via server action)

**Campos do formulário (5):**
1. Leads WhatsApp (label azul)
2. Agendadas (label azul)
3. Realizadas (label azul)
4. Falta — lead (label vermelho)
5. Não realizada (label vermelho)

Grid 2 colunas, campo 5 ocupa 1 coluna inteira ou col-span.

---

## Server Actions

### Novas actions

| Action | Descrição |
|---|---|
| `upsertSdrLog(date, data)` | Cria ou atualiza o lançamento de uma data |
| `getSdrLogs(startDate, endDate)` | Retorna todos os logs no intervalo |
| `getSdrLogByDate(date)` | Retorna lançamento de uma data específica (para pré-preencher modal) |

### Actions mantidas

As actions de `DashboardMetric` e `DashboardGoal` continuam sem alteração.

---

## Componentes novos / modificados

| Componente | Status | Descrição |
|---|---|---|
| `dashboard-view.tsx` | Modificado | Layout completo redesenhado |
| `period-selector.tsx` | Novo | Dropdowns de filtro de período |
| `kpi-card.tsx` | Modificado | Adiciona prop `colorVariant` (blue/amber/red) e `delta` |
| `sdr-launch-modal.tsx` | Novo | Modal de lançamento diário (substitui `add-metric-modal`) |
| `funnel-chart.tsx` | Novo | Gráfico de funil horizontal (Recharts) |
| `daily-line-chart.tsx` | Novo | Gráfico de linha temporal (Recharts) |
| `add-metric-modal.tsx` | Mantido | Para lançamento de vendas/faturamento (sem alteração) |
| `edit-metric-modal.tsx` | Mantido | Para edição de vendas/faturamento (sem alteração) |

---

## Schema Prisma — adição

```prisma
model SdrDailyLog {
  id             String   @id @default(cuid())
  date           DateTime @unique
  leadsWhatsapp  Int      @default(0)
  agendadas      Int      @default(0)
  realizadas     Int      @default(0)
  faltaLead      Int      @default(0)
  naoRealizada   Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

Migration: additive, não quebra dados existentes.

---

## Biblioteca de gráficos

`recharts` **não está instalado** — instalar como parte da implementação:
```
npm install recharts
```
Recharts é a única biblioteca de gráficos a adicionar. Não usar Tremor, Chart.js ou similares.

---

## O que NÃO muda

- Sistema de metas (`DashboardGoal`) — lógica e UI inalteradas
- Sistema de vendas/faturamento (`DashboardMetric`) — mantido como está
- Autenticação, outras abas (Kanban, Mentoria, Tarefas)
- Tema dark, paleta de cores base

---

## Critérios de aceitação

- [ ] SDR consegue fazer lançamento diário via modal com 5 campos
- [ ] Dashboard exibe KPIs SDR e Vendas em seções distintas com cores diferentes
- [ ] Filtro de período altera todos os KPIs e gráficos simultaneamente
- [ ] Comparação vs período anterior exibe deltas percentuais em cada KPI
- [ ] Funil de conversão mostra 4 estágios (WA → Agendadas → Realizadas → Vendas)
- [ ] Gráfico de linha mostra evolução diária com 3 séries no período selecionado
- [ ] Lançamento do mesmo dia sobrescreve (upsert) sem criar duplicatas
- [ ] Metas Verde/Prata/Ouro continuam funcionando com dados de faturamento
