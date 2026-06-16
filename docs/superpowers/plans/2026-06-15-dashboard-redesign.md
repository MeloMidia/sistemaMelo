# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar lançamento diário do SDR com gráficos históricos, filtro de período e layout inspirado no padrão Mercado Livre, mantendo o sistema de vendas/faturamento existente intacto.

**Architecture:** Dois trilhos de dados: (1) `DashboardMetric` existente para totais de vendas/faturamento (sem alteração no modelo), e (2) novo `SdrDailyLog` com data única por dia (upsert). O dashboard busca os dois trilhos filtrados pelo período selecionado, calcula deltas contra o período de comparação, e renderiza em grid unificado com gráficos Recharts abaixo.

**Tech Stack:** Next.js 16.2.2, React 19, TailwindCSS v4, Prisma 6.4.0 (PostgreSQL), Recharts (instalar), shadcn/ui existente

---

## Mapa de arquivos

**Novos:**
- `src/lib/date-range.ts` — utilitários puros de cálculo de período
- `src/app/actions/sdr.ts` — server actions para SdrDailyLog
- `src/components/dashboard/period-selector.tsx` — dropdowns de período
- `src/components/dashboard/sdr-launch-modal.tsx` — modal de lançamento diário
- `src/components/dashboard/funnel-chart.tsx` — gráfico de funil (Recharts)
- `src/components/dashboard/daily-line-chart.tsx` — gráfico de linha temporal (Recharts)

**Modificados:**
- `prisma/schema.prisma` — adicionar modelo SdrDailyLog
- `src/app/actions/metrics.ts` — adicionar filtro de período em getDashboardData
- `src/components/dashboard/kpi-card.tsx` — adicionar colorVariant e delta
- `src/components/dashboard/dashboard-view.tsx` — reescrita completa

---

### Task 1: Instalar recharts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar dependência**

```bash
npm install recharts
```

- [ ] **Step 2: Verificar instalação**

Confirmar que `recharts` aparece em `dependencies` no `package.json`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install recharts for dashboard charts"
```

---

### Task 2: Adicionar SdrDailyLog ao schema Prisma

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar modelo ao schema**

Abrir `prisma/schema.prisma` e adicionar após o modelo `DashboardGoal`:

```prisma
model SdrDailyLog {
  id            String   @id @default(cuid())
  date          DateTime @unique
  leadsWhatsapp Int      @default(0)
  agendadas     Int      @default(0)
  realizadas    Int      @default(0)
  faltaLead     Int      @default(0)
  naoRealizada  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

- [ ] **Step 2: Sincronizar com o banco**

```bash
npx prisma db push
```

Saída esperada: `✔ Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerar cliente Prisma**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add SdrDailyLog model to prisma schema"
```

---

### Task 3: Criar utilitário de intervalo de datas

**Files:**
- Create: `src/lib/date-range.ts`

- [ ] **Step 1: Criar arquivo**

Criar `src/lib/date-range.ts` com o conteúdo:

```ts
export type PeriodKey = 'this-month' | 'last-month' | 'last-30' | 'last-90'

export type DateRange = { start: Date; end: Date }

export function getDateRange(period: PeriodKey): DateRange {
  const now = new Date()

  if (period === 'this-month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    }
  }

  if (period === 'last-month') {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1
    return {
      start: new Date(y, m, 1),
      end: new Date(y, m + 1, 0, 23, 59, 59, 999),
    }
  }

  if (period === 'last-30') {
    const start = new Date(now)
    start.setDate(now.getDate() - 30)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  // last-90
  const start = new Date(now)
  start.setDate(now.getDate() - 90)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export function getPreviousPeriodRange(range: DateRange): DateRange {
  const diffMs = range.end.getTime() - range.start.getTime() + 1
  return {
    start: new Date(range.start.getTime() - diffMs),
    end: new Date(range.start.getTime() - 1),
  }
}

export function normalizeDateToMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function formatDateLabel(date: Date | string): string {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
```

- [ ] **Step 2: Verificar lógica manualmente**

No terminal Node.js (`node`), testar:
```js
// Verificar this-month em junho
const d = new Date(2026, 5, 15)
// getDateRange('this-month') deve retornar {start: 2026-06-01, end: 2026-06-30}

// Verificar last-month
// getDateRange('last-month') deve retornar {start: 2026-05-01, end: 2026-05-31}

// Verificar getPreviousPeriodRange para junho completo
// Deve retornar ~maio completo
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/date-range.ts
git commit -m "feat: add date range utility for period filtering"
```

---

### Task 4: Criar server actions do SDR

**Files:**
- Create: `src/app/actions/sdr.ts`

- [ ] **Step 1: Criar arquivo**

Criar `src/app/actions/sdr.ts`:

```ts
'use server'

import { prisma } from '@/lib/prisma'
import { normalizeDateToMidnight } from '@/lib/date-range'

export type SdrLogData = {
  leadsWhatsapp: number
  agendadas: number
  realizadas: number
  faltaLead: number
  naoRealizada: number
}

export async function upsertSdrLog(date: Date, data: SdrLogData) {
  const normalizedDate = normalizeDateToMidnight(new Date(date))
  return prisma.sdrDailyLog.upsert({
    where: { date: normalizedDate },
    create: { date: normalizedDate, ...data },
    update: data,
  })
}

export async function getSdrLogs(startDate: Date, endDate: Date) {
  return prisma.sdrDailyLog.findMany({
    where: { date: { gte: new Date(startDate), lte: new Date(endDate) } },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      leadsWhatsapp: true,
      agendadas: true,
      realizadas: true,
      faltaLead: true,
      naoRealizada: true,
    },
  })
}

export async function getSdrLogByDate(date: Date) {
  const normalizedDate = normalizeDateToMidnight(new Date(date))
  return prisma.sdrDailyLog.findUnique({
    where: { date: normalizedDate },
    select: {
      leadsWhatsapp: true,
      agendadas: true,
      realizadas: true,
      faltaLead: true,
      naoRealizada: true,
    },
  })
}
```

**Nota:** `new Date(date)` nos wrappers existe porque server actions serializam Date para string ao cruzar a fronteira cliente→servidor. O `new Date(date)` garante que a conversão funciona em ambos os casos.

- [ ] **Step 2: Verificar tipos**

Rodar:
```bash
npx tsc --noEmit
```
Esperado: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/sdr.ts
git commit -m "feat: add SDR daily log server actions"
```

---

### Task 5: Atualizar getDashboardData para suportar filtro de período

**Files:**
- Modify: `src/app/actions/metrics.ts`

- [ ] **Step 1: Adicionar parâmetros de data em getDashboardData**

Substituir apenas a função `getDashboardData` em `src/app/actions/metrics.ts` (manter `addDashboardMetric` e `overwriteDashboardMetrics` intactas):

```ts
export async function getDashboardData(startDate?: Date, endDate?: Date) {
  const where =
    startDate && endDate
      ? { date: { gte: new Date(startDate), lte: new Date(endDate) } }
      : {}

  const metrics = await prisma.dashboardMetric.findMany({ where })
  const goal = await prisma.dashboardGoal.findFirst()

  const aggregated = metrics.reduce(
    (acc, curr) => ({
      leadsTrafego: acc.leadsTrafego + curr.leadsTrafego,
      leadsIndicacao: acc.leadsIndicacao + curr.leadsIndicacao,
      reunioesAgendadas: acc.reunioesAgendadas + curr.reunioesAgendadas,
      reunioesRealizadas: acc.reunioesRealizadas + curr.reunioesRealizadas,
      vendasQtd: acc.vendasQtd + curr.vendasQtd,
      faturamento: acc.faturamento + curr.faturamento,
      investimentoTrafego: acc.investimentoTrafego + curr.investimentoTrafego,
    }),
    {
      leadsTrafego: 0,
      leadsIndicacao: 0,
      reunioesAgendadas: 0,
      reunioesRealizadas: 0,
      vendasQtd: 0,
      faturamento: 0,
      investimentoTrafego: 0,
    }
  )

  let currentGoal = goal
  if (!currentGoal) {
    try {
      currentGoal = await prisma.dashboardGoal.create({ data: {} })
    } catch {
      currentGoal = await prisma.dashboardGoal.findFirst()
    }
  }

  return { metrics: aggregated, goals: currentGoal! }
}
```

**Nota:** A linha `const prisma = new PrismaClient()` no topo do arquivo atual deve ser substituída por `import { prisma } from '@/lib/prisma'` para usar o singleton. Remover o `import { PrismaClient } from '@prisma/client'` e a criação manual.

O arquivo completo atualizado ficará:

```ts
'use server'

import { prisma } from '@/lib/prisma'

export async function getDashboardData(startDate?: Date, endDate?: Date) {
  const where =
    startDate && endDate
      ? { date: { gte: new Date(startDate), lte: new Date(endDate) } }
      : {}

  const metrics = await prisma.dashboardMetric.findMany({ where })
  const goal = await prisma.dashboardGoal.findFirst()

  const aggregated = metrics.reduce(
    (acc, curr) => ({
      leadsTrafego: acc.leadsTrafego + curr.leadsTrafego,
      leadsIndicacao: acc.leadsIndicacao + curr.leadsIndicacao,
      reunioesAgendadas: acc.reunioesAgendadas + curr.reunioesAgendadas,
      reunioesRealizadas: acc.reunioesRealizadas + curr.reunioesRealizadas,
      vendasQtd: acc.vendasQtd + curr.vendasQtd,
      faturamento: acc.faturamento + curr.faturamento,
      investimentoTrafego: acc.investimentoTrafego + curr.investimentoTrafego,
    }),
    {
      leadsTrafego: 0,
      leadsIndicacao: 0,
      reunioesAgendadas: 0,
      reunioesRealizadas: 0,
      vendasQtd: 0,
      faturamento: 0,
      investimentoTrafego: 0,
    }
  )

  let currentGoal = goal
  if (!currentGoal) {
    try {
      currentGoal = await prisma.dashboardGoal.create({ data: {} })
    } catch {
      currentGoal = await prisma.dashboardGoal.findFirst()
    }
  }

  return { metrics: aggregated, goals: currentGoal! }
}

export async function addDashboardMetric(data: {
  leadsTrafego: number
  leadsIndicacao: number
  reunioesAgendadas: number
  reunioesRealizadas: number
  vendasQtd: number
  faturamento: number
  investimentoTrafego: number
}) {
  const newMetric = await prisma.dashboardMetric.create({
    data: {
      leadsTrafego: Number(data.leadsTrafego),
      leadsIndicacao: Number(data.leadsIndicacao),
      reunioesAgendadas: Number(data.reunioesAgendadas),
      reunioesRealizadas: Number(data.reunioesRealizadas),
      vendasQtd: Number(data.vendasQtd),
      faturamento: Number(data.faturamento),
      investimentoTrafego: Number(data.investimentoTrafego),
    },
  })
  return { success: true, metric: newMetric }
}

export async function overwriteDashboardMetrics(data: {
  leadsTrafego: number
  leadsIndicacao: number
  reunioesAgendadas: number
  reunioesRealizadas: number
  vendasQtd: number
  faturamento: number
  investimentoTrafego: number
}) {
  await prisma.dashboardMetric.deleteMany()
  const newMetric = await prisma.dashboardMetric.create({
    data: {
      leadsTrafego: Number(data.leadsTrafego),
      leadsIndicacao: Number(data.leadsIndicacao),
      reunioesAgendadas: Number(data.reunioesAgendadas),
      reunioesRealizadas: Number(data.reunioesRealizadas),
      vendasQtd: Number(data.vendasQtd),
      faturamento: Number(data.faturamento),
      investimentoTrafego: Number(data.investimentoTrafego),
    },
  })
  return { success: true, metric: newMetric }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/metrics.ts
git commit -m "feat: add date range filtering to getDashboardData"
```

---

### Task 6: Atualizar KpiCard com colorVariant e delta

**Files:**
- Modify: `src/components/dashboard/kpi-card.tsx`

- [ ] **Step 1: Substituir o arquivo completo**

```tsx
import React from 'react'

export type KpiColorVariant = 'default' | 'blue' | 'amber' | 'red'

export interface KpiDelta {
  value: string
  direction: 'up' | 'down' | 'neutral'
}

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: React.ReactNode
  colorVariant?: KpiColorVariant
  delta?: KpiDelta
}

const borderClasses: Record<KpiColorVariant, string> = {
  default: 'border-l-white/10',
  blue: 'border-l-indigo-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
}

const deltaTextClasses = {
  up: 'text-emerald-400',
  down: 'text-red-400',
  neutral: 'text-slate-500',
}

const deltaArrows = { up: '▲', down: '▼', neutral: '—' }

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  colorVariant = 'default',
  delta,
}: KpiCardProps) {
  return (
    <div
      className={`bg-white/[0.02] border border-white/[0.05] border-l-4 ${borderClasses[colorVariant]} rounded-xl p-5 hover:bg-white/[0.04] transition-colors flex flex-col justify-between h-full relative overflow-hidden group min-h-[110px]`}
    >
      <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-white/[0.02] blur-xl rounded-full group-hover:bg-white/[0.05] transition-colors" />

      <div className="flex items-start justify-between mb-3 relative z-10">
        <h3 className="text-slate-400 text-xs font-medium pr-4">{title}</h3>
        {icon && (
          <div className="text-slate-500 shrink-0 bg-white/[0.03] p-1.5 rounded-lg border border-white/[0.05]">
            {icon}
          </div>
        )}
      </div>

      <div className="relative z-10 mt-auto">
        <div className="text-2xl font-semibold text-white tracking-tight">{value}</div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {subtitle && <div className="text-xs text-slate-500 font-medium">{subtitle}</div>}
          {delta && (
            <span className={`text-xs font-semibold ${deltaTextClasses[delta.direction]}`}>
              {deltaArrows[delta.direction]} {delta.value}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Se houver erros em outros arquivos que importam `KpiCard`, verificar — as props antigas (`title`, `value`, `subtitle`, `icon`) ainda funcionam; `colorVariant` e `delta` são opcionais.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/kpi-card.tsx
git commit -m "feat: add colorVariant and delta props to KpiCard"
```

---

### Task 7: Criar PeriodSelector

**Files:**
- Create: `src/components/dashboard/period-selector.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
'use client'

import React from 'react'
import { ChevronDown } from 'lucide-react'
import type { PeriodKey } from '@/lib/date-range'

const PERIOD_LABELS: Record<PeriodKey, string> = {
  'this-month': 'Este mês',
  'last-month': 'Mês anterior',
  'last-30': 'Últimos 30 dias',
  'last-90': 'Últimos 90 dias',
}

interface PeriodSelectorProps {
  period: PeriodKey
  showComparison: boolean
  onPeriodChange: (p: PeriodKey) => void
  onComparisonChange: (show: boolean) => void
}

export function PeriodSelector({
  period,
  showComparison,
  onPeriodChange,
  onComparisonChange,
}: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative">
        <select
          value={period}
          onChange={e => onPeriodChange(e.target.value as PeriodKey)}
          className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2 pr-9 text-sm text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map(key => (
            <option key={key} value={key} className="bg-[#0f111a]">
              {PERIOD_LABELS[key]}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      <div className="relative">
        <select
          value={showComparison ? 'previous' : 'none'}
          onChange={e => onComparisonChange(e.target.value === 'previous')}
          className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2 pr-9 text-sm text-slate-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="previous" className="bg-[#0f111a]">
            Comparar: período anterior
          </option>
          <option value="none" className="bg-[#0f111a]">
            Sem comparação
          </option>
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/period-selector.tsx
git commit -m "feat: add PeriodSelector component"
```

---

### Task 8: Criar SdrLaunchModal

**Files:**
- Create: `src/components/dashboard/sdr-launch-modal.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
'use client'

import React, { useState } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { upsertSdrLog, getSdrLogByDate, type SdrLogData } from '@/app/actions/sdr'

interface SdrLaunchModalProps {
  onSuccess: () => void
}

const EMPTY_FORM = {
  leadsWhatsapp: '',
  agendadas: '',
  realizadas: '',
  faltaLead: '',
  naoRealizada: '',
}

const FIELDS: { name: keyof typeof EMPTY_FORM; label: string; color: 'blue' | 'red'; colSpan?: boolean }[] = [
  { name: 'leadsWhatsapp', label: 'Leads WhatsApp', color: 'blue' },
  { name: 'agendadas', label: 'Agendadas', color: 'blue' },
  { name: 'realizadas', label: 'Realizadas', color: 'blue' },
  { name: 'faltaLead', label: 'Falta — lead', color: 'red' },
  { name: 'naoRealizada', label: 'Não realizada', color: 'red', colSpan: true },
]

export function SdrLaunchModal({ onSuccess }: SdrLaunchModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM })

  const today = new Date()
  const todayLabel = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const open = async () => {
    setIsOpen(true)
    setIsFetching(true)
    try {
      const existing = await getSdrLogByDate(today)
      if (existing) {
        setForm({
          leadsWhatsapp: String(existing.leadsWhatsapp),
          agendadas: String(existing.agendadas),
          realizadas: String(existing.realizadas),
          faltaLead: String(existing.faltaLead),
          naoRealizada: String(existing.naoRealizada),
        })
      } else {
        setForm({ ...EMPTY_FORM })
      }
    } finally {
      setIsFetching(false)
    }
  }

  const close = () => {
    setIsOpen(false)
    setForm({ ...EMPTY_FORM })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    setForm(prev => ({ ...prev, [e.target.name]: raw }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const data: SdrLogData = {
        leadsWhatsapp: Number(form.leadsWhatsapp || 0),
        agendadas: Number(form.agendadas || 0),
        realizadas: Number(form.realizadas || 0),
        faltaLead: Number(form.faltaLead || 0),
        naoRealizada: Number(form.naoRealizada || 0),
      }
      await upsertSdrLog(today, data)
      close()
      onSuccess()
    } catch (error) {
      console.error(error)
      alert('Erro ao salvar lançamento.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={open}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-500/25 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Lançar dia
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#07080c]/80 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="bg-[#0f111a] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start p-6 border-b border-white/5">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Lançamento do dia</h2>
            <p className="text-xs text-slate-500 mt-1 capitalize">{todayLabel}</p>
          </div>
          <button onClick={close} className="text-slate-400 hover:text-white transition-colors cursor-pointer mt-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isFetching ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {FIELDS.map(field => (
                <div key={field.name} className={field.colSpan ? 'col-span-2' : ''}>
                  <label
                    className={`text-xs font-medium mb-1.5 block ${
                      field.color === 'red' ? 'text-red-400' : 'text-indigo-400'
                    }`}
                  >
                    {field.label}
                  </label>
                  <input
                    type="text"
                    name={field.name}
                    value={form[field.name]}
                    onChange={handleChange}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar lançamento'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/sdr-launch-modal.tsx
git commit -m "feat: add SdrLaunchModal component"
```

---

### Task 9: Criar FunnelChart

**Files:**
- Create: `src/components/dashboard/funnel-chart.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface FunnelChartProps {
  leadsWhatsapp: number
  agendadas: number
  realizadas: number
  vendas: number
}

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#f59e0b']

export function FunnelChart({ leadsWhatsapp, agendadas, realizadas, vendas }: FunnelChartProps) {
  const data = [
    { name: 'Leads WA', value: leadsWhatsapp },
    { name: 'Agendadas', value: agendadas },
    { name: 'Realizadas', value: realizadas },
    { name: 'Vendas', value: vendas },
  ]

  if (leadsWhatsapp === 0 && agendadas === 0 && realizadas === 0 && vendas === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-slate-500 text-sm">
        Nenhum dado no período
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart layout="vertical" data={data} margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={82}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          contentStyle={{
            background: '#0f111a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
          }}
          labelStyle={{ color: '#e2e8f0', fontSize: 12 }}
          itemStyle={{ color: '#94a3b8', fontSize: 12 }}
          formatter={(value: number) => [value, '']}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#94a3b8', fontSize: 12 }}>
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/funnel-chart.tsx
git commit -m "feat: add FunnelChart component with Recharts"
```

---

### Task 10: Criar DailyLineChart

**Files:**
- Create: `src/components/dashboard/daily-line-chart.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
'use client'

import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { formatDateLabel } from '@/lib/date-range'

interface DayPoint {
  date: Date | string
  leadsWhatsapp: number
  agendadas: number
  realizadas: number
}

interface DailyLineChartProps {
  data: DayPoint[]
}

export function DailyLineChart({ data }: DailyLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-slate-500 text-sm">
        Nenhum lançamento no período selecionado
      </div>
    )
  }

  const chartData = data.map(d => ({
    date: formatDateLabel(d.date),
    'Leads WA': d.leadsWhatsapp,
    Agendadas: d.agendadas,
    Realizadas: d.realizadas,
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: '#0f111a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
          }}
          labelStyle={{ color: '#e2e8f0', fontSize: 12 }}
          itemStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }} />
        <Line type="monotone" dataKey="Leads WA" stroke="#6366f1" strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="Agendadas"
          stroke="#818cf8"
          strokeWidth={2}
          strokeDasharray="4 2"
          dot={false}
        />
        <Line type="monotone" dataKey="Realizadas" stroke="#10b981" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/daily-line-chart.tsx
git commit -m "feat: add DailyLineChart component with Recharts"
```

---

### Task 11: Reescrever DashboardView

**Files:**
- Modify: `src/components/dashboard/dashboard-view.tsx`

- [ ] **Step 1: Substituir o arquivo completo**

```tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Loader2, Target } from 'lucide-react'
import { getDashboardData } from '@/app/actions/metrics'
import { getSdrLogs } from '@/app/actions/sdr'
import { getDateRange, getPreviousPeriodRange, type PeriodKey } from '@/lib/date-range'
import { KpiCard, type KpiDelta } from './kpi-card'
import { PeriodSelector } from './period-selector'
import { SdrLaunchModal } from './sdr-launch-modal'
import { FunnelChart } from './funnel-chart'
import { DailyLineChart } from './daily-line-chart'
import { AddMetricModal } from './add-metric-modal'
import { EditMetricModal } from './edit-metric-modal'
import { TriGoalBar } from './tri-goal-bar'

type SdrLog = {
  date: Date | string
  leadsWhatsapp: number
  agendadas: number
  realizadas: number
  faltaLead: number
  naoRealizada: number
}

type MetricTotals = {
  leadsTrafego: number
  leadsIndicacao: number
  reunioesAgendadas: number
  reunioesRealizadas: number
  vendasQtd: number
  faturamento: number
  investimentoTrafego: number
}

type SdrTotals = {
  leadsWhatsapp: number
  agendadas: number
  realizadas: number
  faltaLead: number
  naoRealizada: number
}

function aggregateSdrLogs(logs: SdrLog[]): SdrTotals {
  return logs.reduce(
    (acc, log) => ({
      leadsWhatsapp: acc.leadsWhatsapp + log.leadsWhatsapp,
      agendadas: acc.agendadas + log.agendadas,
      realizadas: acc.realizadas + log.realizadas,
      faltaLead: acc.faltaLead + log.faltaLead,
      naoRealizada: acc.naoRealizada + log.naoRealizada,
    }),
    { leadsWhatsapp: 0, agendadas: 0, realizadas: 0, faltaLead: 0, naoRealizada: 0 }
  )
}

function calcDelta(current: number, previous: number | null): KpiDelta | undefined {
  if (previous === null || previous === 0) return undefined
  const pct = ((current - previous) / previous) * 100
  return {
    value: `${Math.abs(pct).toFixed(0)}%`,
    direction: pct > 1 ? 'up' : pct < -1 ? 'down' : 'neutral',
  }
}

const EMPTY_METRICS: MetricTotals = {
  leadsTrafego: 0,
  leadsIndicacao: 0,
  reunioesAgendadas: 0,
  reunioesRealizadas: 0,
  vendasQtd: 0,
  faturamento: 0,
  investimentoTrafego: 0,
}

const EMPTY_SDR: SdrTotals = {
  leadsWhatsapp: 0,
  agendadas: 0,
  realizadas: 0,
  faltaLead: 0,
  naoRealizada: 0,
}

export function DashboardView() {
  const [period, setPeriod] = useState<PeriodKey>('this-month')
  const [showComparison, setShowComparison] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  const [currentMetrics, setCurrentMetrics] = useState<MetricTotals>(EMPTY_METRICS)
  const [prevMetrics, setPrevMetrics] = useState<MetricTotals | null>(null)
  const [sdrLogs, setSdrLogs] = useState<SdrLog[]>([])
  const [prevSdrTotals, setPrevSdrTotals] = useState<SdrTotals | null>(null)
  const [goals, setGoals] = useState({ faturamento: 50000, leads: 1000, reunioesAgendadas: 200, reunioesRealizadas: 150 })

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const range = getDateRange(period)
      const [current, logs] = await Promise.all([
        getDashboardData(range.start, range.end),
        getSdrLogs(range.start, range.end),
      ])
      setCurrentMetrics(current.metrics)
      setGoals(current.goals as typeof goals)
      setSdrLogs(logs as SdrLog[])

      if (showComparison) {
        const prevRange = getPreviousPeriodRange(range)
        const [prev, prevLogs] = await Promise.all([
          getDashboardData(prevRange.start, prevRange.end),
          getSdrLogs(prevRange.start, prevRange.end),
        ])
        setPrevMetrics(prev.metrics)
        setPrevSdrTotals(aggregateSdrLogs(prevLogs as SdrLog[]))
      } else {
        setPrevMetrics(null)
        setPrevSdrTotals(null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [period, showComparison])

  useEffect(() => { loadData() }, [loadData])

  const sdr = aggregateSdrLogs(sdrLogs)
  const cac = currentMetrics.vendasQtd > 0
    ? currentMetrics.investimentoTrafego / currentMetrics.vendasQtd
    : 0
  const taxaLeadVenda = sdr.leadsWhatsapp > 0
    ? (currentMetrics.vendasQtd / sdr.leadsWhatsapp) * 100
    : 0
  const prevCac = prevMetrics && prevMetrics.vendasQtd > 0
    ? prevMetrics.investimentoTrafego / prevMetrics.vendasQtd
    : null

  const formatMoney = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const formatNum = (v: number) => v.toLocaleString('pt-BR')

  // Goals
  const GOAL_1 = 50000
  const GOAL_2 = 65000
  const GOAL_3 = 80000
  let salesActiveGoal = GOAL_1
  if (currentMetrics.faturamento >= GOAL_2) salesActiveGoal = GOAL_3
  else if (currentMetrics.faturamento >= GOAL_1) salesActiveGoal = GOAL_2
  const leftToNextGoal = Math.max(0, salesActiveGoal - currentMetrics.faturamento)
  const salesPercentageText = (currentMetrics.faturamento / GOAL_1) * 100

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-6 pb-10">

        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PeriodSelector
            period={period}
            showComparison={showComparison}
            onPeriodChange={setPeriod}
            onComparisonChange={setShowComparison}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <SdrLaunchModal onSuccess={loadData} />
            <EditMetricModal onSuccess={loadData} initialData={currentMetrics} />
            <AddMetricModal onSuccess={loadData} />
          </div>
        </div>

        {/* SDR KPIs */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">
            Métricas SDR — Reuniões & Leads
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard
              title="Leads WhatsApp"
              value={formatNum(sdr.leadsWhatsapp)}
              colorVariant="blue"
              delta={calcDelta(sdr.leadsWhatsapp, prevSdrTotals?.leadsWhatsapp ?? null)}
            />
            <KpiCard
              title="Agendadas"
              value={formatNum(sdr.agendadas)}
              colorVariant="blue"
              delta={calcDelta(sdr.agendadas, prevSdrTotals?.agendadas ?? null)}
            />
            <KpiCard
              title="Realizadas"
              value={formatNum(sdr.realizadas)}
              colorVariant="blue"
              delta={calcDelta(sdr.realizadas, prevSdrTotals?.realizadas ?? null)}
            />
            <KpiCard
              title="Falta — lead"
              value={formatNum(sdr.faltaLead)}
              colorVariant="red"
              delta={calcDelta(sdr.faltaLead, prevSdrTotals?.faltaLead ?? null)}
            />
            <KpiCard
              title="Não realizada"
              value={formatNum(sdr.naoRealizada)}
              colorVariant="red"
              delta={calcDelta(sdr.naoRealizada, prevSdrTotals?.naoRealizada ?? null)}
            />
          </div>
        </section>

        {/* Sales KPIs */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">
            Vendas & Faturamento
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Faturamento"
              value={formatMoney(currentMetrics.faturamento)}
              colorVariant="amber"
              delta={calcDelta(currentMetrics.faturamento, prevMetrics?.faturamento ?? null)}
            />
            <KpiCard
              title="Vendas fechadas"
              value={formatNum(currentMetrics.vendasQtd)}
              colorVariant="amber"
              delta={calcDelta(currentMetrics.vendasQtd, prevMetrics?.vendasQtd ?? null)}
            />
            <KpiCard
              title="Taxa lead→venda"
              value={`${taxaLeadVenda.toFixed(1)}%`}
              colorVariant="amber"
              subtitle="Vendas / Leads WA"
            />
            <KpiCard
              title="CAC médio"
              value={formatMoney(cac)}
              colorVariant="amber"
              delta={calcDelta(cac, prevCac)}
            />
          </div>
        </section>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.8fr] gap-4">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Funil de conversão</h3>
            <FunnelChart
              leadsWhatsapp={sdr.leadsWhatsapp}
              agendadas={sdr.agendadas}
              realizadas={sdr.realizadas}
              vendas={currentMetrics.vendasQtd}
            />
          </div>
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Evolução diária</h3>
            <DailyLineChart
              data={sdrLogs.map(l => ({
                date: l.date,
                leadsWhatsapp: l.leadsWhatsapp,
                agendadas: l.agendadas,
                realizadas: l.realizadas,
              }))}
            />
          </div>
        </div>

        {/* Goals */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            Metas de Vendas & KPIs de Escala
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.04] transition-colors relative overflow-hidden group h-full flex flex-col justify-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500 to-teal-400 opacity-[0.05] blur-3xl rounded-full group-hover:opacity-[0.1] transition-opacity" />
                <div className="flex justify-between items-end mb-6 relative z-10">
                  <div>
                    <h3 className="text-slate-400 text-sm font-medium mb-1">META DE VENDAS (Faturamento)</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-white tracking-tight">{formatMoney(currentMetrics.faturamento)}</span>
                      <span className="text-sm font-medium text-slate-500">/ Meta: {formatMoney(salesActiveGoal)}</span>
                    </div>
                  </div>
                  <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-yellow-500">
                    {salesPercentageText.toFixed(0)}%
                  </span>
                </div>
                <div className="relative z-10 w-full pb-6">
                  <div className="h-4 w-full rounded-full shadow-inner flex overflow-hidden border border-white/5">
                    <div className="h-full bg-slate-900 relative flex-shrink-0" style={{ width: '62.5%' }}>
                      <div className="h-full bg-gradient-to-r from-emerald-700 to-emerald-400 transition-all duration-1000 ease-out absolute left-0 top-0" style={{ width: `${Math.min((currentMetrics.faturamento / GOAL_1) * 100, 100)}%` }} />
                    </div>
                    <div className="w-px h-full bg-white/25 flex-shrink-0" />
                    <div className="h-full bg-slate-900 relative flex-shrink-0" style={{ width: '18.75%' }}>
                      <div className="h-full bg-gradient-to-r from-slate-500 to-slate-300 transition-all duration-1000 ease-out absolute left-0 top-0" style={{ width: `${Math.min(Math.max((currentMetrics.faturamento - GOAL_1) / (GOAL_2 - GOAL_1) * 100, 0), 100)}%` }} />
                    </div>
                    <div className="w-px h-full bg-white/25 flex-shrink-0" />
                    <div className="h-full bg-slate-900 relative flex-1">
                      <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-300 transition-all duration-1000 ease-out absolute left-0 top-0" style={{ width: `${Math.min(Math.max((currentMetrics.faturamento - GOAL_2) / (GOAL_3 - GOAL_2) * 100, 0), 100)}%` }} />
                    </div>
                  </div>
                  <div className="relative mt-1.5 text-[10px] w-full">
                    <span className="absolute left-0 text-emerald-500/70 font-medium">0</span>
                    <span className="absolute text-emerald-500/70 font-medium" style={{ left: 'calc(62.5% - 10px)' }}>50K</span>
                    <span className="absolute text-slate-400/70 font-medium" style={{ left: 'calc(81.25% - 10px)' }}>65K</span>
                    <span className="absolute right-0 text-yellow-600/70 font-medium">80K ✦</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 flex flex-col justify-center items-center text-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500 to-yellow-400 opacity-[0.05] blur-3xl rounded-full group-hover:opacity-[0.1] transition-opacity" />
              <h3 className="text-slate-400 text-sm font-medium mb-2">
                {leftToNextGoal === 0
                  ? '🏆 Meta de 80K Atingida!'
                  : `Falta para a Meta (${salesActiveGoal >= 1000 ? `${salesActiveGoal / 1000}K` : salesActiveGoal})`}
              </h3>
              <span className="text-3xl font-bold text-white tracking-tight">
                {leftToNextGoal === 0 ? formatMoney(currentMetrics.faturamento) : formatMoney(leftToNextGoal)}
              </span>
              {leftToNextGoal === 0 && (
                <span className="text-sm text-yellow-400 mt-2 font-medium">✨ Todas as metas concluídas! ✨</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TriGoalBar title="Total de Vendas" currentValue={currentMetrics.vendasQtd} goal1={19} goal2={25} goal3={31} formatValue={formatNum} />
            <TriGoalBar title="Leads WhatsApp" currentValue={sdr.leadsWhatsapp} goal1={225} goal2={295} goal3={368} formatValue={formatNum} />
            <TriGoalBar title="Reuniões Agendadas" currentValue={sdr.agendadas} goal1={90} goal2={118} goal3={147} formatValue={formatNum} />
            <TriGoalBar title="Reuniões Realizadas" currentValue={sdr.realizadas} goal1={63} goal2={83} goal3={103} formatValue={formatNum} />
          </div>
        </section>

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Resolver qualquer erro de tipo antes de continuar.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/dashboard-view.tsx
git commit -m "feat: rewrite DashboardView with SDR section, period filter and charts"
```

---

### Task 12: Verificação final no browser

- [ ] **Step 1: Iniciar servidor de desenvolvimento**

```bash
npm run dev
```

- [ ] **Step 2: Verificar no browser (http://localhost:3000)**

Checklist:
- [ ] Dashboard carrega sem erros no console
- [ ] Seletor de período "Este mês" / "Mês anterior" / "Últimos 30 dias" / "Últimos 90 dias" funciona
- [ ] Toggle "Comparar: período anterior" / "Sem comparação" funciona e remove os deltas dos cards
- [ ] Botão "Lançar dia" abre o modal com os 5 campos
- [ ] Ao salvar, modal fecha e dashboard atualiza os cards SDR
- [ ] Ao reabrir o modal no mesmo dia, os valores preenchidos aparecem (pré-preenchimento)
- [ ] Seção SDR mostra cards azuis (Leads WA, Agendadas, Realizadas) e vermelhos (Falta, Não realizada)
- [ ] Seção Vendas mostra cards âmbar (Faturamento, Vendas, Taxa, CAC)
- [ ] Funil de conversão renderiza sem erros (mesmo que com zeros)
- [ ] Gráfico de linha renderiza sem erros
- [ ] Metas Verde/Prata/Ouro continuam funcionando
- [ ] Botões "Lançar Resultados" e edição de vendas/faturamento continuam funcionando

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat: dashboard redesign complete - SDR daily logs, charts, period filter"
```
