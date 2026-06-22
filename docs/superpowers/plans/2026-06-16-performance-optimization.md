# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate redundant network requests, cut unnecessary re-renders, and reduce database query count on hot paths — with no UI behavior changes and no schema changes.

**Architecture:** Three layers: (1) add `staleTime` to React Query hooks to stop refetching fresh data; (2) migrate DashboardView from manual useState+useEffect to React Query so period data is cached and periods already visited load instantly; (3) optimistic updates on task flag toggles for instant UI feedback; (4) batch reorder API to replace N individual SQL UPDATE statements with one.

**Tech Stack:** Next.js 16.2.2 (App Router), React 19, @tanstack/react-query v5, Prisma 6.4.0, PostgreSQL, TypeScript.

---

## File Map

| File | Change |
|------|--------|
| `src/hooks/api.ts` | Add `staleTime` to all hooks; add `useDashboardData` + `useDashboardPrev`; rewrite `useUpdateTask` with optimistic update + surgical invalidation |
| `src/components/dashboard/dashboard-view.tsx` | Replace manual fetch (useState+useEffect+useCallback) with `useDashboardData` / `useDashboardPrev` hooks |
| `src/app/api/tasks/reorder/route.ts` | Replace N individual prisma.task.update calls with one raw SQL batch UPDATE |
| `src/app/api/columns/reorder/route.ts` | Same batch pattern for columns |

---

## Task 1: Add staleTime to All Existing React Query Hooks

**Files:**
- Modify: `src/hooks/api.ts`

With the default `staleTime: 0`, React Query refetches on every component mount even if the data is 1 second old. Setting `staleTime: 30_000` means data is treated as fresh for 30 seconds — no refetch on navigation or remount within that window. Completed tasks (history) change even less often, so `staleTime: 60_000`.

- [ ] **Step 1: Open `src/hooks/api.ts` and add `staleTime` to every `useQuery` call**

Replace the entire file content with:

```ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Column, Task } from '@/types'

// ——— Columns ———
export function useColumns(source: string = 'kanban') {
  return useQuery<Column[]>({
    queryKey: ['columns', source],
    queryFn: async () => {
      const res = await fetch(`/api/columns?source=${source}`)
      if (!res.ok) throw new Error('Failed to fetch columns')
      return res.json()
    },
    staleTime: 30_000,
  })
}

export function useCreateColumn(source: string = 'kanban') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch('/api/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, source }),
      })
      if (!res.ok) throw new Error('Failed to create column')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns', source] }),
  })
}

export function useUpdateColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; order?: number }) => {
      const res = await fetch(`/api/columns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update column')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns'] }),
  })
}

export function useDeleteColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/columns/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete column')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns'] }),
  })
}

export function useReorderColumns() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: { id: string; order: number }[]) => {
      const res = await fetch('/api/columns/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error('Failed to reorder columns')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns'] }),
  })
}

// ——— Tasks ———
export function useAllTasks() {
  return useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await fetch('/api/tasks')
      if (!res.ok) throw new Error('Failed to fetch tasks')
      return res.json()
    },
    staleTime: 30_000,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      title: string
      description?: string
      dueDate?: string
      isPriorityToday?: boolean
      columnId: string
    }) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create task')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['columns'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: unknown }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update task')
      return res.json()
    },
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previousTasks = qc.getQueryData<Task[]>(['tasks'])
      qc.setQueryData<Task[]>(['tasks'], old =>
        old?.map(t => t.id === id ? { ...t, ...data } as Task : t) ?? []
      )
      return { previousTasks }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousTasks !== undefined) {
        qc.setQueryData(['tasks'], ctx.previousTasks)
      }
    },
    onSettled: (_data, _err, variables) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['columns'] })
      if ('completedAt' in variables) {
        qc.invalidateQueries({ queryKey: ['tasks-history'] })
      }
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete task')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['columns'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useCompletedTasks() {
  return useQuery<Task[]>({
    queryKey: ['tasks-history'],
    queryFn: async () => {
      const res = await fetch('/api/tasks/history')
      if (!res.ok) throw new Error('Failed to fetch history')
      return res.json()
    },
    staleTime: 60_000,
  })
}

export function useReorderTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: { id: string; columnId: string; order: number }[]) => {
      const res = await fetch('/api/tasks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error('Failed to reorder tasks')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns'] }),
  })
}
```

Note: This file already includes the optimistic update for `useUpdateTask` (Task 4 of this plan). Both changes are applied together here since they are in the same file.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Smoke test**

Start the dev server (`npm run dev`), open the Tarefas page, toggle the "Aguardando" button on a task. The toggle should feel instant (no loading delay) — this is the optimistic update working.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/api.ts
git commit -m "perf: add staleTime to all React Query hooks + optimistic updates on useUpdateTask"
```

---

## Task 2: Add useDashboardData and useDashboardPrev Hooks

**Files:**
- Modify: `src/hooks/api.ts`

These two hooks encapsulate the dashboard data fetching so `DashboardView` can use React Query instead of manual state management. The `queryKey` includes the period, so each period gets its own cache slot — switching from "Este mês" to "Mês anterior" and back loads the second period instantly.

- [ ] **Step 1: Add imports at the top of `src/hooks/api.ts`**

Add these three imports after the existing imports (before any export):

```ts
import { getDashboardData } from '@/app/actions/metrics'
import { getSdrLogs } from '@/app/actions/sdr'
import { getDateRange, getPreviousPeriodRange, type PeriodKey } from '@/lib/date-range'
```

- [ ] **Step 2: Add useDashboardData and useDashboardPrev at the bottom of `src/hooks/api.ts`**

Append after `useReorderTasks`:

```ts
// ——— Dashboard ———
export type DashboardData = {
  metrics: Awaited<ReturnType<typeof getDashboardData>>['metrics']
  logs: Awaited<ReturnType<typeof getSdrLogs>>
}

export function useDashboardData(period: PeriodKey) {
  return useQuery<DashboardData>({
    queryKey: ['dashboard', period],
    queryFn: async () => {
      const range = getDateRange(period)
      const [current, logs] = await Promise.all([
        getDashboardData(range.start, range.end),
        getSdrLogs(range.start, range.end),
      ])
      return { metrics: current.metrics, logs }
    },
    staleTime: 60_000,
  })
}

export function useDashboardPrev(period: PeriodKey, enabled: boolean) {
  return useQuery<DashboardData>({
    queryKey: ['dashboard', period, 'prev'],
    queryFn: async () => {
      const range = getDateRange(period)
      const prevRange = getPreviousPeriodRange(range)
      const [prev, logs] = await Promise.all([
        getDashboardData(prevRange.start, prevRange.end),
        getSdrLogs(prevRange.start, prevRange.end),
      ])
      return { metrics: prev.metrics, logs }
    },
    staleTime: 60_000,
    enabled,
  })
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/api.ts
git commit -m "perf: add useDashboardData and useDashboardPrev React Query hooks"
```

---

## Task 3: Migrate DashboardView to React Query

**Files:**
- Modify: `src/components/dashboard/dashboard-view.tsx`

Replace all manual data-loading state (`useState`, `useEffect`, `useCallback`, `loadData`) with the two hooks from Task 2. The JSX body (from the `return` statement onward) is unchanged except for three `onSuccess` prop values.

- [ ] **Step 1: Replace the top section of `src/components/dashboard/dashboard-view.tsx`**

Replace everything from line 1 up to (but NOT including) the `return (` statement with:

```tsx
'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Target } from 'lucide-react'
import { type PeriodKey } from '@/lib/date-range'
import { useDashboardData, useDashboardPrev, type DashboardData } from '@/hooks/api'
import { KpiCard, type KpiDelta } from './kpi-card'
import { PeriodSelector } from './period-selector'
import { SdrLaunchModal } from './sdr-launch-modal'
import { FunnelChart } from './funnel-chart'
import { DailyLineChart } from './daily-line-chart'
import { AddMetricModal } from './add-metric-modal'
import { EditMetricModal } from './edit-metric-modal'
import { TriGoalBar } from './tri-goal-bar'

type SdrLog = DashboardData['logs'][number]

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

export function DashboardView() {
  const [period, setPeriod] = useState<PeriodKey>('this-month')
  const [showComparison, setShowComparison] = useState(true)
  const queryClient = useQueryClient()

  const { data: currentData, isLoading } = useDashboardData(period)
  const { data: prevData } = useDashboardPrev(period, showComparison)

  const currentMetrics: MetricTotals = currentData?.metrics ?? EMPTY_METRICS
  const sdrLogs: SdrLog[] = currentData?.logs ?? []
  const prevMetrics: MetricTotals | null = prevData?.metrics ?? null
  const prevSdrTotals: SdrTotals | null = prevData ? aggregateSdrLogs(prevData.logs) : null

  const onSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', period] })
  }, [queryClient, period])

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
```

- [ ] **Step 2: Update the three `onSuccess` props in the JSX**

In the JSX (inside the `return` block), find and replace all three occurrences of `loadData` with `onSuccess`:

```tsx
// BEFORE:
<SdrLaunchModal onSuccess={loadData} />
<EditMetricModal onSuccess={loadData} initialData={currentMetrics} />
<AddMetricModal onSuccess={loadData} />

// AFTER:
<SdrLaunchModal onSuccess={onSuccess} />
<EditMetricModal onSuccess={onSuccess} initialData={currentMetrics} />
<AddMetricModal onSuccess={onSuccess} />
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Smoke test**

Open the Dashboard page. Verify it loads data. Switch from "Este mês" to "Mês anterior". Switch back. The second time you switch back, it should load **instantly** from cache (no spinner). Click "Lançar dia", save a log, verify the dashboard refreshes.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/dashboard-view.tsx
git commit -m "perf: migrate DashboardView to React Query — period data now cached"
```

---

## Task 4: Batch Reorder API — Single SQL Statement

**Files:**
- Modify: `src/app/api/tasks/reorder/route.ts`
- Modify: `src/app/api/columns/reorder/route.ts`

Currently, reordering N tasks runs N individual `prisma.task.update()` calls inside a transaction — one SQL `UPDATE` statement per task. For a board with 20 tasks, that is 20 round-trips within the transaction. A single `UPDATE … FROM (VALUES …)` statement updates all rows in one round-trip regardless of N.

The `"Task"` and `"Column"` table names come from the Prisma schema (no `@@map` annotation, so Prisma uses PascalCase matching the model name). IDs are `String @id @default(uuid())` stored as TEXT in PostgreSQL — no UUID casting needed.

- [ ] **Step 1: Replace `src/app/api/tasks/reorder/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { items } = await request.json()
  if (!items?.length) return NextResponse.json({ success: true })

  const rows = (items as { id: string; columnId: string; order: number }[]).map(i =>
    Prisma.sql`(${i.id}, ${i.columnId}, ${i.order}::int4)`
  )

  await prisma.$executeRaw`
    UPDATE "Task" AS t
    SET "columnId" = v.column_id, "order" = v.ord
    FROM (VALUES ${Prisma.join(rows)}) AS v(id, column_id, ord)
    WHERE t.id = v.id
  `

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Replace `src/app/api/columns/reorder/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { items } = await request.json()
  if (!items?.length) return NextResponse.json({ success: true })

  const rows = (items as { id: string; order: number }[]).map(i =>
    Prisma.sql`(${i.id}, ${i.order}::int4)`
  )

  await prisma.$executeRaw`
    UPDATE "Column" AS c
    SET "order" = v.ord
    FROM (VALUES ${Prisma.join(rows)}) AS v(id, ord)
    WHERE c.id = v.id
  `

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Smoke test**

Open the Kanban (Processos) page. Drag a task from one column to another. Verify it saves correctly and persists after page refresh. Then reorder columns by dragging a column header — verify the order persists after refresh.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tasks/reorder/route.ts src/app/api/columns/reorder/route.ts
git commit -m "perf: batch reorder API — N SQL UPDATE statements replaced with single VALUES query"
```

---

## Self-Review

**Spec coverage:**
- ✅ Layer 1B (staleTime on all hooks) → Task 1
- ✅ Layer 1A (useDashboardData + useDashboardPrev) → Task 2
- ✅ Layer 1A (DashboardView migration) → Task 3
- ✅ Layer 1C (optimistic update on useUpdateTask) → included in Task 1 (same file, same commit)
- ✅ Layer 1C (surgical invalidation — remove tasks-history from non-complete updates) → Task 1
- ✅ Layer 2 (batch reorder SQL) → Task 4

**Type consistency check:**
- `DashboardData` defined in Task 2 (`hooks/api.ts`), imported in Task 3 (`dashboard-view.tsx`) as `DashboardData['logs'][number]` for `SdrLog`. ✅
- `useDashboardData` returns `useQuery<DashboardData>` — `currentData?.metrics` is `MetricTotals`-compatible since `getDashboardData` returns the same shape. ✅
- `useDashboardPrev` has `enabled` param of type `boolean`, used as `useDashboardPrev(period, showComparison)` in Task 3. ✅
- Batch SQL uses `"Task"` and `"Column"` table names — matches Prisma schema (no `@@map`). ✅

**No placeholders found.**
