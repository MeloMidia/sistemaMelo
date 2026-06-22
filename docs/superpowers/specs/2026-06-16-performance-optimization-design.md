# Performance Optimization — Implementation Design

## Goal

Reduce redundant network requests, eliminate unnecessary re-renders, and cut database query count on hot paths — without changing any UI behavior or database schema.

## Architecture

Three independent layers, each addressable by a separate task:

```
LAYER 1 — React Query client cache
  Dashboard migrates from useState+useEffect to useQuery
  staleTime: 30 000ms on all task/column queries
  staleTime: 60 000ms on dashboard queries
  Selective (surgical) cache invalidation per mutation context

LAYER 2 — API route batch operations
  /api/tasks/reorder   — N individual updates → 1 prisma.$transaction with updateMany per item (already batched, but use raw SQL UPDATE … CASE for true O(1))
  /api/columns/reorder — same

LAYER 3 — Prisma / PostgreSQL
  No schema changes
```

**Files modified:**
- `src/hooks/api.ts` — staleTime on all existing hooks + new `useDashboardData` / `useSdrLogs` hooks
- `src/components/dashboard/dashboard-view.tsx` — migrate from manual fetch to React Query hooks
- `src/app/api/tasks/reorder/route.ts` — batch with single transaction + raw SQL CASE UPDATE
- `src/app/api/columns/reorder/route.ts` — same pattern

**No new dependencies. No schema changes.**

---

## Layer 1A — Dashboard React Query Migration

### Current problem
`DashboardView` uses `useState + useEffect + useCallback` for data fetching. Every period change triggers a full refetch from scratch. Returning to a previously-viewed period re-fetches even though the data hasn't changed.

### Solution
Two `useQuery` hooks with period-keyed cache:

```ts
// src/hooks/api.ts — new hooks

export function useDashboardData(period: PeriodKey) {
  return useQuery({
    queryKey: ['dashboard', period],
    queryFn: async () => {
      const range = getDateRange(period)
      const [metrics, logs] = await Promise.all([
        getDashboardData(range.start, range.end),
        getSdrLogs(range.start, range.end),
      ])
      return { metrics, logs }
    },
    staleTime: 60_000,
  })
}

export function useDashboardPrev(period: PeriodKey, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', period, 'prev'],
    queryFn: async () => {
      const range = getDateRange(period)
      const prevRange = getPreviousPeriodRange(range)
      const [metrics, logs] = await Promise.all([
        getDashboardData(prevRange.start, prevRange.end),
        getSdrLogs(prevRange.start, prevRange.end),
      ])
      return { metrics, logs }
    },
    staleTime: 60_000,
    enabled,
  })
}
```

`DashboardView` removes all manual state (`currentMetrics`, `prevMetrics`, `sdrLogs`, `prevSdrTotals`, `isLoading`) and replaces with the two hooks above. The `onSuccess={loadData}` callback in `SdrLaunchModal` and `AddMetricModal` becomes `() => queryClient.invalidateQueries({ queryKey: ['dashboard', period] })`.

### Behavior change (intentional)
- Period already visited → instant render from cache
- `showComparison: false` → prev query not fired (`enabled: false`)
- After SDR launch → only current period refetches

---

## Layer 1B — staleTime on All Existing Hooks

Default `staleTime` in React Query is 0ms. Every component mount triggers a background refetch even if data is seconds old. Setting `staleTime: 30_000` means data is considered fresh for 30 seconds — no refetch on remount within that window.

Apply to all hooks in `src/hooks/api.ts`:

| Hook | staleTime |
|------|-----------|
| `useColumns` | 30 000ms |
| `useAllTasks` | 30 000ms |
| `useCompletedTasks` | 60 000ms |
| `useDashboardData` (new) | 60 000ms |
| `useDashboardPrev` (new) | 60 000ms |

---

## Layer 1C — Surgical Cache Invalidation

### Current problem
Every mutation invalidates multiple query keys indiscriminately:

```ts
// useUpdateTask — invalidates THREE query families on every toggle
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ['columns'] })
  qc.invalidateQueries({ queryKey: ['tasks'] })
  qc.invalidateQueries({ queryKey: ['tasks-history'] })
}
```

Toggling `isWaiting` on a task (which only affects task display in task-manager) triggers a refetch of `columns` (used in kanban), `tasks`, and `tasks-history`. None of those are needed for a simple flag toggle.

### Solution — per-mutation invalidation rules

| Mutation | Invalidate |
|----------|-----------|
| `useCreateTask` | `['columns', source]` only (task lives in a column) |
| `useUpdateTask` (flag toggle: isWaiting, isPriorityToday, isDoing) | `['tasks']` only |
| `useUpdateTask` (column move) | `['columns']` only |
| `useUpdateTask` (complete → completedAt set) | `['tasks']` + `['tasks-history']` |
| `useDeleteTask` | `['tasks']` + `['columns']` |
| `useReorderTasks` | `['columns']` only — needed to sync server truth after drag |
| `useReorderColumns` | `['columns']` only |

Since `useUpdateTask` is generic (`{ id, ...data }`), we inspect which fields are present in `data` inside `onSuccess` to decide what to invalidate. Alternatively, split into `useToggleTaskFlag` and `useUpdateTaskFull` — simpler to reason about.

**Decision: split into two hooks:**
- `useUpdateTask` — for field updates (title, description, dueDate, assignee) → invalidates `['tasks']` + `['columns']`
- `useToggleTaskFlag` — for boolean flag toggles (isWaiting, isPriorityToday, isDoing, completedAt) → uses optimistic update + targeted invalidation

For `useToggleTaskFlag`, apply **optimistic update** pattern:
```ts
onMutate: async ({ id, ...flags }) => {
  await qc.cancelQueries({ queryKey: ['tasks'] })
  const prev = qc.getQueryData<Task[]>(['tasks'])
  qc.setQueryData<Task[]>(['tasks'], old =>
    old?.map(t => t.id === id ? { ...t, ...flags } : t) ?? []
  )
  return { prev }
},
onError: (_, __, ctx) => {
  qc.setQueryData(['tasks'], ctx?.prev)
},
onSettled: () => {
  qc.invalidateQueries({ queryKey: ['tasks'] })
}
```

This makes flag toggles (Aguardando, Prioridade) feel **instantaneous** — the UI updates before the server responds, and rolls back only on error.

---

## Layer 2 — Batch Reorder API

### Current problem
`/api/tasks/reorder` receives `items: [{id, columnId, order}]` and executes one `prisma.task.update()` per item inside a transaction. For a board with 15 tasks, that is 15 sequential SQL `UPDATE` statements inside one transaction.

### Solution — raw SQL batch UPDATE with CASE

```ts
// Single query — all rows updated in one round-trip
await prisma.$executeRaw`
  UPDATE "Task"
  SET
    "columnId" = CASE id
      ${Prisma.join(items.map(i => Prisma.sql`WHEN ${i.id}::uuid THEN ${i.columnId}::uuid`))}
    END,
    "order" = CASE id
      ${Prisma.join(items.map(i => Prisma.sql`WHEN ${i.id}::uuid THEN ${i.order}`))}
    END
  WHERE id IN (${Prisma.join(items.map(i => Prisma.sql`${i.id}::uuid`))})
`
```

Same pattern applied to `/api/columns/reorder`.

**Result:** N tasks reordered = 1 SQL query (was N queries).

---

## Error Handling

- Optimistic updates roll back on error (React Query `onError` with previous snapshot).
- Batch SQL errors surface as 500 with `{ error: 'Failed to reorder' }` — same as current behavior.
- Dashboard query errors show the existing loading spinner until resolved.

---

## What Is NOT Changed

- No UI changes — all optimizations are invisible to the user except perceived speed.
- No database schema changes.
- No new npm packages.
- No changes to authentication or middleware.
- Mentoria board (`useColumns('mentoria')`) gets `staleTime` for free since it uses the same hook.
