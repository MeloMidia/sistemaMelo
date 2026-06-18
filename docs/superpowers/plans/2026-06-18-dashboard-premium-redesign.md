# Dashboard Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Dashboard tab (`DashboardView` and its child components) from a multi-color glassmorphism look into a restrained, single-accent "premium SaaS" visual style (Linear/Vercel-inspired), without changing any business logic, data flow, or page structure.

**Architecture:** Add a small set of CSS custom properties scoped to a `.dash` wrapper class (added once, on `DashboardView`'s root element) in `globals.css`. Every dashboard component then references those variables (`var(--dash-surface)`, `var(--dash-accent)`, etc.) instead of the ad-hoc Tailwind opacity literals (`bg-white/[0.02]`, `border-white/[0.05]`) and category colors (amber/blue/red/emerald/yellow) it uses today. No new dependencies, no new components, no routing/data changes.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4 (CSS-variable-based theme already in use), Recharts for charts. No test runner is configured in this project (`package.json` has no `test` script) — verification for every task is `npx tsc --noEmit` (type safety) and `npm run lint` (ESLint), plus a final manual visual check in the browser.

---

## File Structure

| File | Change |
|---|---|
| `src/app/globals.css` | Add `.dash { ... }` token block |
| `src/components/dashboard/dashboard-view.tsx` | Add `dash` class to root; restyle inline hero/goal cards, section headers, chart card wrappers, action button triggers |
| `src/components/dashboard/kpi-card.tsx` | Remove `colorVariant`/top-border categorization; neutral surface |
| `src/components/dashboard/tri-goal-bar.tsx` | Replace 3-color segmented bar with single accent fill + tier divider lines + tier badge |
| `src/components/dashboard/funnel-chart.tsx` | Replace 4-color palette with single-accent opacity ramp |
| `src/components/dashboard/daily-line-chart.tsx` | Replace 3-color palette with accent/accent-light/neutral |
| `src/components/dashboard/period-selector.tsx` | Restyle select triggers with new tokens |
| `src/components/dashboard/sdr-launch-modal.tsx` | Restyle trigger button + modal surface/inputs |
| `src/components/dashboard/add-metric-modal.tsx` | Restyle trigger button + modal surface/inputs; emerald money fields → accent |
| `src/components/dashboard/edit-metric-modal.tsx` | Restyle trigger button + modal surface/inputs; emerald money fields → accent; amber warning banner → red (semantic danger, unchanged hue family) |

No files are deleted. `src/components/dashboard/goal-bar.tsx` is unused dead code (no imports found anywhere) and is out of scope — leave it untouched.

---

### Task 1: Add dashboard design tokens

**Files:**
- Modify: `src/app/globals.css:177` (end of file, after the existing `.glass-card-hover:hover` block)

- [ ] **Step 1: Append the token block**

Add this at the end of `src/app/globals.css`:

```css

/* Dashboard design tokens — scoped to .dash (DashboardView root). Does not affect Kanban/Mentoria/Tasks. */
.dash {
  --dash-surface: rgba(255, 255, 255, 0.025);
  --dash-surface-hover: rgba(255, 255, 255, 0.045);
  --dash-border: rgba(255, 255, 255, 0.07);
  --dash-border-strong: rgba(255, 255, 255, 0.12);
  --dash-accent: #6366f1;
  --dash-accent-soft: rgba(99, 102, 241, 0.12);
  --dash-text-muted: #8b94a7;
  --dash-text-faint: #5b6478;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output (success). CSS isn't type-checked, but this confirms the project still builds its TS graph cleanly before further changes.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add scoped dashboard design tokens"
```

---

### Task 2: Apply `.dash` scope to DashboardView root

**Files:**
- Modify: `src/components/dashboard/dashboard-view.tsx:119`

- [ ] **Step 1: Add the `dash` class to the root container**

Find:

```tsx
  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
```

Replace with:

```tsx
  return (
    <div className="dash flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/dashboard-view.tsx
git commit -m "feat: scope dashboard root to .dash token namespace"
```

---

### Task 3: Restyle `KpiCard` — remove color-by-category, keep semantic delta colors

**Files:**
- Modify: `src/components/dashboard/kpi-card.tsx` (full rewrite)
- Modify: `src/components/dashboard/dashboard-view.tsx:214-277` (remove `colorVariant` props)

- [ ] **Step 1: Rewrite `kpi-card.tsx`**

Replace the entire file contents with:

```tsx
import React from 'react'

export interface KpiDelta {
  value: string
  direction: 'up' | 'down' | 'neutral'
}

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: React.ReactNode
  delta?: KpiDelta
}

const deltaColors = {
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
  delta,
}: KpiCardProps) {
  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-5 hover:bg-[var(--dash-surface-hover)] transition-colors flex flex-col gap-2 min-h-[100px]">
      <div className="flex items-center justify-between">
        <p className="text-[var(--dash-text-muted)] text-xs font-medium">{title}</p>
        {icon && <div className="text-[var(--dash-text-faint)]">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold text-white tracking-tight leading-none">{value}</span>
        {delta && (
          <span className={`text-xs font-semibold ${deltaColors[delta.direction]}`}>
            {deltaArrows[delta.direction]} {delta.value}
          </span>
        )}
      </div>

      {subtitle && <p className="text-xs text-[var(--dash-text-faint)]">{subtitle}</p>}
    </div>
  )
}
```

This removes the `KpiColorVariant` type and the `colorVariant` prop entirely — there is no other importer of `KpiColorVariant` in the codebase (verified: only `dashboard-view.tsx` consumes `KpiCard`/`KpiDelta`).

- [ ] **Step 2: Remove `colorVariant` props from all 9 call sites in `dashboard-view.tsx`**

In `src/components/dashboard/dashboard-view.tsx`, delete every line that reads exactly (with leading whitespace) one of:

```tsx
              colorVariant="amber"
```
```tsx
              colorVariant="blue"
```
```tsx
              colorVariant="red"
```

There are 4 occurrences of `colorVariant="amber"` (Faturamento, Vendas fechadas, Taxa lead→venda, CAC médio), 3 of `colorVariant="blue"` (Leads WhatsApp, Agendadas, Realizadas), and 2 of `colorVariant="red"` (Falta — lead, Não realizada) — 9 lines total. After deletion, for example, the "Faturamento" card goes from:

```tsx
            <KpiCard
              title="Faturamento"
              value={formatMoney(currentMetrics.faturamento)}
              colorVariant="amber"
              delta={calcDelta(currentMetrics.faturamento, prevMetrics?.faturamento ?? null)}
            />
```

to:

```tsx
            <KpiCard
              title="Faturamento"
              value={formatMoney(currentMetrics.faturamento)}
              delta={calcDelta(currentMetrics.faturamento, prevMetrics?.faturamento ?? null)}
            />
```

Apply the same removal pattern to all 9 `<KpiCard ... />` blocks in the "Sales KPIs" and "SDR KPIs" sections.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no output. (If `colorVariant` is still referenced anywhere, this will fail with a "Property 'colorVariant' does not exist" or similar error — fix any missed call site.)

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/kpi-card.tsx src/components/dashboard/dashboard-view.tsx
git commit -m "refactor: remove color-by-category from KpiCard, keep semantic delta colors"
```

---

### Task 4: Restyle `TriGoalBar` — single accent fill, tier markers, tier badge

**Files:**
- Modify: `src/components/dashboard/tri-goal-bar.tsx` (full rewrite)

- [ ] **Step 1: Rewrite `tri-goal-bar.tsx`**

Replace the entire file contents with:

```tsx
import React from 'react'

interface TriGoalBarProps {
  title: string
  currentValue: number
  goal1: number   // Tier 1 — meta base (100%)
  goal2: number   // Tier 2 — meta intermediária
  goal3: number   // Tier 3 — meta máxima
  formatValue?: (val: number) => string
}

export function TriGoalBar({ title, currentValue, goal1, goal2, goal3, formatValue }: TriGoalBarProps) {
  const fmt = formatValue ?? ((v: number) => v.toString())

  // Porcentagem sempre relativa à meta base (goal1 = 100%)
  const percentText = goal1 > 0 ? (currentValue / goal1) * 100 : 0

  // Meta ativa = próxima meta ainda não atingida; tier atual para o badge
  let activeGoal = goal1
  let tier = 1
  if (currentValue >= goal2) {
    activeGoal = goal3
    tier = 3
  } else if (currentValue >= goal1) {
    activeGoal = goal2
    tier = 2
  }

  // Posição dos marcadores de tier, relativa à meta máxima (goal3 = 100% da largura)
  const total = goal3
  const marker1 = (goal1 / total) * 100
  const marker2 = (goal2 / total) * 100

  // Preenchimento único da barra, relativo à meta máxima
  const fillTotal = Math.min((currentValue / total) * 100, 100)

  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-5 hover:bg-[var(--dash-surface-hover)] transition-colors">
      {/* Header */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h3 className="text-[var(--dash-text-muted)] text-sm font-medium mb-1">{title}</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-white tracking-tight">{fmt(currentValue)}</span>
            <span className="text-sm font-medium text-[var(--dash-text-faint)]">/ Meta: {fmt(activeGoal)}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-white">{percentText.toFixed(0)}%</span>
          <p className="text-[10px] font-medium uppercase tracking-wide mt-1 px-1.5 py-0.5 rounded bg-[var(--dash-accent-soft)] text-[var(--dash-accent)] inline-block">
            Tier {tier} de 3
          </p>
        </div>
      </div>

      {/* Bar */}
      <div className="w-full pb-6">
        <div className="relative h-3 w-full rounded-full bg-[var(--dash-border)] overflow-hidden">
          <div
            className="h-full bg-[var(--dash-accent)] transition-all duration-1000 ease-out absolute left-0 top-0"
            style={{ width: `${fillTotal}%` }}
          />
          <div className="absolute top-0 h-full w-px bg-[var(--dash-border-strong)]" style={{ left: `${marker1}%` }} />
          <div className="absolute top-0 h-full w-px bg-[var(--dash-border-strong)]" style={{ left: `${marker2}%` }} />
        </div>

        {/* Labels */}
        <div className="relative mt-1.5 text-[10px] w-full h-4">
          <span className="absolute left-0 text-[var(--dash-text-faint)] font-medium">0</span>
          <span className="absolute text-[var(--dash-text-faint)] font-medium" style={{ left: `calc(${marker1}% - 12px)` }}>{fmt(goal1)}</span>
          <span className="absolute text-[var(--dash-text-faint)] font-medium" style={{ left: `calc(${marker2}% - 12px)` }}>{fmt(goal2)}</span>
          <span className="absolute right-0 text-[var(--dash-text-faint)] font-medium">{fmt(goal3)}</span>
        </div>
      </div>
    </div>
  )
}
```

The component's exported name and props are unchanged, so all 4 call sites in `dashboard-view.tsx` (`<TriGoalBar title="Total de Vendas" .../>` etc.) keep working with no edits needed there.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/tri-goal-bar.tsx
git commit -m "refactor: simplify TriGoalBar to single accent fill with tier markers"
```

---

### Task 5: Restyle `FunnelChart` — single-accent opacity ramp

**Files:**
- Modify: `src/components/dashboard/funnel-chart.tsx:13`

- [ ] **Step 1: Replace the color palette**

Find:

```tsx
const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#f59e0b']
```

Replace with:

```tsx
const COLORS = ['rgba(99,102,241,1)', 'rgba(99,102,241,0.8)', 'rgba(99,102,241,0.6)', 'rgba(99,102,241,0.4)']
```

This keeps the same 4-stage funnel ordering (Leads WA → Agendadas → Realizadas → Vendas) but represents progression through opacity of a single accent hue instead of 4 distinct colors (the last of which, `#f59e0b`, was an unrelated amber).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/funnel-chart.tsx
git commit -m "refactor: use single-accent opacity ramp for funnel chart"
```

---

### Task 6: Restyle `DailyLineChart` — accent + neutral 3-series palette

**Files:**
- Modify: `src/components/dashboard/daily-line-chart.tsx:92-115`

- [ ] **Step 1: Replace the three `<Line>` color/style props**

Find:

```tsx
        <Line
          type="monotone"
          dataKey="Leads WA"
          stroke="#e91e8c"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="Agendadas"
          stroke="#06c5b2"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="Realizadas"
          stroke="#7c4dff"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
```

Replace with:

```tsx
        <Line
          type="monotone"
          dataKey="Leads WA"
          stroke="#6366f1"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="Agendadas"
          stroke="#a5b4fc"
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="Realizadas"
          stroke="#94a3b8"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
```

`#6366f1` is the accent (solid), `#a5b4fc` is a lighter accent tint (dashed, secondary series), `#94a3b8` is a neutral slate (tertiary series) — replacing the previous pink/teal/violet trio.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/daily-line-chart.tsx
git commit -m "refactor: use accent/neutral palette for daily line chart series"
```

---

### Task 7: Restyle `PeriodSelector` triggers

**Files:**
- Modify: `src/components/dashboard/period-selector.tsx:35` and `:53`

- [ ] **Step 1: Restyle the "Período principal" select**

Find:

```tsx
          <select
            value={period}
            onChange={e => onPeriodChange(e.target.value as PeriodKey)}
            className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2 pr-9 text-sm text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
```

Replace with:

```tsx
          <select
            value={period}
            onChange={e => onPeriodChange(e.target.value as PeriodKey)}
            className="appearance-none bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-lg px-4 py-2 pr-9 text-sm text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]"
          >
```

- [ ] **Step 2: Restyle the "Comparar com" select**

Find:

```tsx
          <select
            value={showComparison ? 'previous' : 'none'}
            onChange={e => onComparisonChange(e.target.value === 'previous')}
            className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2 pr-9 text-sm text-slate-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
```

Replace with:

```tsx
          <select
            value={showComparison ? 'previous' : 'none'}
            onChange={e => onComparisonChange(e.target.value === 'previous')}
            className="appearance-none bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-lg px-4 py-2 pr-9 text-sm text-slate-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]"
          >
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/period-selector.tsx
git commit -m "refactor: restyle period selector triggers with dashboard tokens"
```

---

### Task 8: Restyle `DashboardView` — hero/goal cards, section headers, chart card wrappers, action buttons

**Files:**
- Modify: `src/components/dashboard/dashboard-view.tsx`

- [ ] **Step 1: Unify the 3 action-button triggers in the top bar**

The trigger buttons live inside `SdrLaunchModal`, `EditMetricModal`, and `AddMetricModal` — those are handled in Tasks 9–10 below. No change needed in `dashboard-view.tsx` itself for this step; it only renders `<SdrLaunchModal .../> <EditMetricModal .../> <AddMetricModal .../>` already.

- [ ] **Step 2: Restyle the top bar border**

Find:

```tsx
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/5 pb-5">
```

Replace with:

```tsx
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--dash-border)] pb-5">
```

- [ ] **Step 3: Restyle the Goals section icon**

Find:

```tsx
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            Metas de Vendas & KPIs de Escala
          </h2>
```

Replace with:

```tsx
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-[var(--dash-accent)]" />
            Metas de Vendas & KPIs de Escala
          </h2>
```

- [ ] **Step 4: Rewrite the "Meta de Vendas" + "Falta para a Meta" hero cards**

Find this entire block (from the `<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">` that wraps the two hero cards, through its closing `</div>`):

```tsx
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
```

Replace with:

```tsx
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-5 hover:bg-[var(--dash-surface-hover)] transition-colors h-full flex flex-col justify-center">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h3 className="text-[var(--dash-text-muted)] text-sm font-medium mb-1">META DE VENDAS (Faturamento)</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-white tracking-tight">{formatMoney(currentMetrics.faturamento)}</span>
                      <span className="text-sm font-medium text-[var(--dash-text-faint)]">/ Meta: {formatMoney(salesActiveGoal)}</span>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-white">
                    {salesPercentageText.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full pb-6">
                  <div className="relative h-4 w-full rounded-full bg-[var(--dash-border)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--dash-accent)] transition-all duration-1000 ease-out absolute left-0 top-0"
                      style={{ width: `${Math.min((currentMetrics.faturamento / GOAL_3) * 100, 100)}%` }}
                    />
                    <div className="absolute top-0 h-full w-px bg-[var(--dash-border-strong)]" style={{ left: `${(GOAL_1 / GOAL_3) * 100}%` }} />
                    <div className="absolute top-0 h-full w-px bg-[var(--dash-border-strong)]" style={{ left: `${(GOAL_2 / GOAL_3) * 100}%` }} />
                  </div>
                  <div className="relative mt-1.5 text-[10px] w-full">
                    <span className="absolute left-0 text-[var(--dash-text-faint)] font-medium">0</span>
                    <span className="absolute text-[var(--dash-text-faint)] font-medium" style={{ left: 'calc(62.5% - 10px)' }}>50K</span>
                    <span className="absolute text-[var(--dash-text-faint)] font-medium" style={{ left: 'calc(81.25% - 10px)' }}>65K</span>
                    <span className="absolute right-0 text-[var(--dash-text-faint)] font-medium">80K</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-5 flex flex-col justify-center items-center text-center hover:bg-[var(--dash-surface-hover)] transition-colors">
              <h3 className="text-[var(--dash-text-muted)] text-sm font-medium mb-2">
                {leftToNextGoal === 0
                  ? '🏆 Meta de 80K Atingida!'
                  : `Falta para a Meta (${salesActiveGoal >= 1000 ? `${salesActiveGoal / 1000}K` : salesActiveGoal})`}
              </h3>
              <span className="text-3xl font-bold text-white tracking-tight">
                {leftToNextGoal === 0 ? formatMoney(currentMetrics.faturamento) : formatMoney(leftToNextGoal)}
              </span>
              {leftToNextGoal === 0 && (
                <span className="text-sm text-[var(--dash-accent)] mt-2 font-medium">✨ Todas as metas concluídas! ✨</span>
              )}
            </div>
          </div>
```

Note: the progress fill now grows continuously relative to `GOAL_3` (the maximum goal) instead of filling 3 independently-colored segments — this is the same simplification already applied to `TriGoalBar` in Task 4, kept consistent here.

- [ ] **Step 5: Remove the colored "Reuniões & Leads" label from the SDR section header**

Find:

```tsx
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-200">Métricas SDR</h2>
            <span className="text-[11px] text-indigo-400 font-medium uppercase tracking-wider">Reuniões & Leads</span>
          </div>
```

Replace with:

```tsx
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-200">Métricas SDR</h2>
          </div>
```

- [ ] **Step 6: Restyle the two chart card wrappers**

Find:

```tsx
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.8fr] gap-4">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Funil de conversão</h3>
            <p className="text-xs text-slate-500 mb-4">WA → Agendadas → Realizadas → Vendas</p>
            <FunnelChart
              leadsWhatsapp={sdr.leadsWhatsapp}
              agendadas={sdr.agendadas}
              realizadas={sdr.realizadas}
              vendas={currentMetrics.vendasQtd}
            />
          </div>
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Evolução diária</h3>
            <p className="text-xs text-slate-500 mb-4">Leads, agendamentos e realizações por dia</p>
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
```

Replace with:

```tsx
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.8fr] gap-4">
          <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Funil de conversão</h3>
            <p className="text-xs text-[var(--dash-text-faint)] mb-4">WA → Agendadas → Realizadas → Vendas</p>
            <FunnelChart
              leadsWhatsapp={sdr.leadsWhatsapp}
              agendadas={sdr.agendadas}
              realizadas={sdr.realizadas}
              vendas={currentMetrics.vendasQtd}
            />
          </div>
          <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Evolução diária</h3>
            <p className="text-xs text-[var(--dash-text-faint)] mb-4">Leads, agendamentos e realizações por dia</p>
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
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/dashboard-view.tsx
git commit -m "refactor: restyle dashboard hero cards, headers, and chart wrappers with dash tokens"
```

---

### Task 9: Restyle `SdrLaunchModal` trigger + modal surface

**Files:**
- Modify: `src/components/dashboard/sdr-launch-modal.tsx`

- [ ] **Step 1: Restyle the trigger button**

Find:

```tsx
      <button
        onClick={open}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-500/25 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Lançar dia
      </button>
```

Replace with:

```tsx
      <button
        onClick={open}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--dash-surface)] border border-[var(--dash-border)] hover:bg-[var(--dash-surface-hover)] hover:border-[var(--dash-border-strong)] text-slate-300 hover:text-white rounded-lg text-sm font-semibold transition-all cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Lançar dia
      </button>
```

- [ ] **Step 2: Restyle the modal surface and date input**

Find:

```tsx
      <div className="bg-[#0f111a] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="flex justify-between items-start p-6 border-b border-white/5">
```

Replace with:

```tsx
      <div className="bg-[#0f111a] border border-[var(--dash-border)] w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="flex justify-between items-start p-6 border-b border-[var(--dash-border)]">
```

Find:

```tsx
          <input
            type="date"
            value={selectedDate}
            max={toDateInputValue(new Date())}
            onChange={handleDateChange}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          />
```

Replace with:

```tsx
          <input
            type="date"
            value={selectedDate}
            max={toDateInputValue(new Date())}
            onChange={handleDateChange}
            className="w-full bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)] cursor-pointer"
          />
```

- [ ] **Step 3: Restyle the numeric input fields**

Find:

```tsx
                  <input
                    type="text"
                    name={field.name}
                    value={form[field.name]}
                    onChange={handleChange}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
```

Replace with:

```tsx
                  <input
                    type="text"
                    name={field.name}
                    value={form[field.name]}
                    onChange={handleChange}
                    placeholder="0"
                    className="w-full bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]"
                  />
```

- [ ] **Step 4: Restyle the submit button**

Find:

```tsx
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
```

Replace with:

```tsx
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-[var(--dash-accent)] hover:opacity-90 text-white font-semibold rounded-lg transition-opacity disabled:opacity-50 cursor-pointer"
            >
```

(The `field.color` red/blue distinction on the form labels — `text-red-400` for "Falta — lead"/"Não realizada" and `text-indigo-400` for the rest — stays as-is: it's the same per-field label color already defined in the `FIELDS` array, and the red half is a real semantic warning about no-shows/missed meetings, not a decorative category. `text-indigo-400` is close enough to `--dash-accent` to leave untouched here since it's a tiny label, not a structural surface.)

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/sdr-launch-modal.tsx
git commit -m "refactor: restyle SdrLaunchModal with dashboard tokens"
```

---

### Task 10: Restyle `AddMetricModal` trigger + modal surface

**Files:**
- Modify: `src/components/dashboard/add-metric-modal.tsx`

- [ ] **Step 1: Restyle the trigger button**

Find:

```tsx
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-blue-500/25 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Lançar Resultados
      </button>
```

Replace with:

```tsx
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--dash-surface)] border border-[var(--dash-border)] hover:bg-[var(--dash-surface-hover)] hover:border-[var(--dash-border-strong)] text-slate-300 hover:text-white rounded-lg text-sm font-semibold transition-all cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Lançar Resultados
      </button>
```

- [ ] **Step 2: Restyle the modal surface**

Find:

```tsx
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#07080c]/80 backdrop-blur-sm">
      <div className="bg-[#0f111a] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/5">
```

Replace with:

```tsx
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#07080c]/80 backdrop-blur-sm">
      <div className="bg-[#0f111a] border border-[var(--dash-border)] w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[var(--dash-border)]">
```

- [ ] **Step 3: Restyle the 5 neutral input fields (Leads Tráfego, Leads Indicação, Reuniões Agendadas, Reuniões Realizadas, Investimento)**

There are 5 occurrences of this exact className in the file — for `leadsTrafego`, `leadsIndicacao`, `reunioesAgendadas`, `reunioesRealizadas`, and `investimentoTrafego`:

Find (5 occurrences):

```
className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
```

Replace with (all 5 occurrences):

```
className="w-full bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]"
```

- [ ] **Step 4: Restyle the 2 emerald "money" input fields (Vendas, Faturamento) to use accent instead of emerald**

Find (2 occurrences):

```
className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
```

Replace with (both occurrences):

```
className="w-full bg-[var(--dash-accent-soft)] border border-[var(--dash-border-strong)] text-[var(--dash-accent)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]"
```

- [ ] **Step 5: Restyle the submit button**

Find:

```tsx
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-white text-black font-semibold rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar no Histórico'}
          </button>
```

Replace with:

```tsx
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-[var(--dash-accent)] hover:opacity-90 text-white font-semibold rounded-lg transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar no Histórico'}
          </button>
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/add-metric-modal.tsx
git commit -m "refactor: restyle AddMetricModal with dashboard tokens"
```

---

### Task 11: Restyle `EditMetricModal` trigger + modal surface + warning banner

**Files:**
- Modify: `src/components/dashboard/edit-metric-modal.tsx`

- [ ] **Step 1: Restyle the trigger button**

Find:

```tsx
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-slate-300 hover:text-white rounded-lg text-sm font-semibold transition-all cursor-pointer"
      >
        <Edit2 className="w-4 h-4" />
        Corrigir Valores Actuais
      </button>
```

Replace with:

```tsx
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--dash-surface)] border border-[var(--dash-border)] hover:bg-[var(--dash-surface-hover)] hover:border-[var(--dash-border-strong)] text-slate-300 hover:text-white rounded-lg text-sm font-semibold transition-all cursor-pointer"
      >
        <Edit2 className="w-4 h-4" />
        Corrigir Valores Actuais
      </button>
```

- [ ] **Step 2: Restyle the modal surface and header border**

Find:

```tsx
      <div className="bg-[#0f111a] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-6 border-b border-white/5">
```

Replace with:

```tsx
      <div className="bg-[#0f111a] border border-[var(--dash-border)] w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-6 border-b border-[var(--dash-border)]">
```

- [ ] **Step 3: Keep the warning banner red (semantic alert), tighten its styling to match new tokens**

Find:

```tsx
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3">
          <p className="text-xs text-amber-400 font-medium">Atenção: Sobrescreverá todos os valores acumulados pelos números inseridos aqui.</p>
        </div>
```

Replace with:

```tsx
        <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-3">
          <p className="text-xs text-red-400 font-medium">Atenção: Sobrescreverá todos os valores acumulados pelos números inseridos aqui.</p>
        </div>
```

This banner warns about destructive data overwrite — that is a real semantic alert (same category as the negative-delta red already used in `KpiCard`), not a decorative category color, so it moves to the danger red family instead of amber.

- [ ] **Step 4: Restyle the 5 neutral input fields**

Find (5 occurrences):

```
className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
```

Replace with (all 5 occurrences):

```
className="w-full bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]"
```

- [ ] **Step 5: Restyle the 2 emerald "money" input fields to use accent**

Find (2 occurrences):

```
className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
```

Replace with (both occurrences):

```
className="w-full bg-[var(--dash-accent-soft)] border border-[var(--dash-border-strong)] text-[var(--dash-accent)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]"
```

- [ ] **Step 6: Restyle the submit button**

Find:

```tsx
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-white text-black font-semibold rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Alterações'}
          </button>
```

Replace with:

```tsx
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-[var(--dash-accent)] hover:opacity-90 text-white font-semibold rounded-lg transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Alterações'}
          </button>
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/edit-metric-modal.tsx
git commit -m "refactor: restyle EditMetricModal with dashboard tokens, amber warning to red"
```

---

### Task 12: Final manual visual verification

**Files:** none (manual QA pass only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000` with no compile errors.

- [ ] **Step 2: Walk through every dashboard state in the browser**

Log in, open the **Dashboard** tab, and check:
1. Goals section: "Meta de Vendas" bar fills with a single indigo color and shows 2 thin tier-divider lines; "Falta para a Meta" card has no yellow blur/gradient.
2. The 4 `TriGoalBar` cards (Total de Vendas, Leads WhatsApp, Reuniões Agendadas, Reuniões Realizadas) show a single accent bar, tier divider lines, and a "Tier N de 3" badge that updates correctly as you'd expect from each metric's current value.
3. "Vendas & Faturamento" and "Métricas SDR" KPI cards: no colored top border, all 8 cards visually identical except value/label; delta arrows still green/red/gray.
4. Funnel chart bars fade from solid indigo to lighter indigo across the 4 stages.
5. Daily line chart: solid indigo line, dashed light-indigo line, solid gray line — open the "Lançar dia" modal and confirm clicking around still saves a new daily entry correctly (functional regression check, not just visual).
6. Click "Lançar dia", "Corrigir Valores Actuais", and "Lançar Resultados" — all 3 buttons should look visually identical (ghost button with border) and their modals should open with the new neutral/accent input styling. Confirm the "Corrigir Valores Actuais" warning banner is red, not amber.
7. Switch period filter (Este mês / Mês anterior / Últimos 30 dias / Últimos 90 dias) and toggle "Comparar com" — confirm dropdowns still work and selects show the new border styling on focus (indigo ring).

Expected: all of the above look correct and no console errors appear in the browser dev tools.

- [ ] **Step 3: Stop the dev server**

Press `Ctrl+C` in the terminal running `npm run dev`.

(No commit for this task — it's verification only.)

---

## Plan self-review notes

- **Spec coverage:** every "Mudanças por componente" item in the design spec (`docs/superpowers/specs/2026-06-18-dashboard-premium-redesign-design.md`) maps to a task: tokens → Task 1; `.dash` scoping → Task 2; `PeriodSelector` → Task 7; top bar buttons → Tasks 9–11; hero/goal cards → Task 8; `TriGoalBar` → Task 4; `KpiCard` → Task 3; `FunnelChart` → Task 5; `DailyLineChart` → Task 6; section header label removal → Task 8 Step 5; modals → Tasks 9–11.
- **Out of scope items respected:** no Radix `Select` introduced for `PeriodSelector` (Task 7 keeps native `<select>`); no changes to `page.tsx`, Kanban, Mentoria, or Tasks; `goal-bar.tsx` left untouched as dead code, out of scope.
- **No test framework exists in this repo** (confirmed via `package.json` — no `test` script, no jest/vitest dependency), so every task's verification step uses `npx tsc --noEmit` (and `npm run lint` where most relevant) instead of unit tests, plus a final manual browser walk-through in Task 12.
