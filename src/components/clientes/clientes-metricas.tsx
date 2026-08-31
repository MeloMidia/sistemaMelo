'use client'

import { useState, useMemo } from 'react'
import { useColumns } from '@/hooks/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Users, UserPlus, UserMinus, Percent, ChevronLeft, ChevronRight,
  ArrowUpRight, Zap, Megaphone, BookOpen, AlertTriangle, Loader2,
  TrendingUp, TrendingDown, X,
} from 'lucide-react'
import { isChurnColumnTitle } from '@/lib/clientes'
import type { Task } from '@/types'

/* ── Constants ──────────────────────────────────────────────────────────── */
const MESES_ABR   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const ETAPA_CORES = ['#2854DF','#5E82F2','#7997F0','#A7B9F5','#C98720','#16805D','#BC4C4B']
type PeriodMode = 'month' | 'custom' | 'total'
type ClienteTask = Task & { origem: 'Processos' | 'Mentoria' }

/* ── Helpers ────────────────────────────────────────────────────────────── */
function startOf(y: number, m: number) { return new Date(y, m, 1) }
function endOf(y: number, m: number)   { return new Date(y, m + 1, 0, 23, 59, 59, 999) }
function startOfDay(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}
function endOfDay(value: string) {
  const date = startOfDay(value)
  date.setHours(23, 59, 59, 999)
  return date
}
function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
function formatRange(start: Date, end: Date) {
  const sameYear = start.getFullYear() === end.getFullYear()
  const startFormat = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  const endFormat = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  return `${startFormat.format(start)} – ${endFormat.format(end)}`
}
function inRange(d: string | null | undefined, s: Date, e: Date) {
  if (!d) return false; const dt = new Date(d); return dt >= s && dt <= e
}

/* ── Custom Tooltip ─────────────────────────────────────────────────────── */
interface ChartTipPayloadItem {
  dataKey?: unknown
  name?: unknown
  value?: unknown
  fill?: string
}
function ChartTip({ active, payload, label }: { active?: boolean; payload?: readonly ChartTipPayloadItem[]; label?: string | number }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--nm-bg)', border: '1px solid var(--nm-border)',
      boxShadow: '-4px -4px 10px var(--nm-light), 4px 4px 10px var(--nm-dark)',
      borderRadius: 10, padding: '10px 14px',
    }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 6 }}>{label}</p>
      {payload.map((p, index) => (
        <div key={`${String(p.dataKey ?? p.name ?? 'value')}-${index}`} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:p.fill, flexShrink:0 }} />
          <span style={{ color:'#fff', fontSize:13, fontWeight:700 }}>{String(p.value ?? '')}</span>
          <span style={{ color:'rgba(255,255,255,0.38)', fontSize:11 }}>{String(p.name ?? '')}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Featured KPI card (primeiro, destaque com gradiente) ───────────────── */
function FeaturedCard({
  label, value, sub, delta, icon: Icon,
}: { label: string; value: number; sub: string; delta?: number; icon: React.ElementType }) {
  const hasDelta = delta !== undefined
  const up = (delta ?? 0) >= 0
  return (
    <div
      className="mf-metrics-inverse rounded-2xl p-6 flex flex-col justify-between min-h-[160px]"
      style={{
        background: 'linear-gradient(135deg, #151817 0%, #252B34 72%, #2854DF 160%)',
        boxShadow: '0 14px 30px rgba(21,24,23,0.16)',
        border: '1px solid rgba(255,255,255,0.16)',
        flex: '1.4 1 0',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(216,244,226,0.16)', border: '1px solid rgba(216,244,226,0.24)' }}>
          <Icon className="w-5 h-5 text-emerald-100" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-white/30" />
      </div>

      <div>
        <p className="text-[52px] font-extrabold text-white leading-none tracking-tight">{value}</p>
        <p className="text-[12px] text-white/60 mt-2 font-medium">{label}</p>
        {hasDelta ? (
          <div className={`flex items-center gap-1 mt-2 text-[11px] font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
            {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {(delta ?? 0) > 0 ? `+${delta}` : delta} {sub}
          </div>
        ) : (
          <p className="text-[11px] text-white/45 mt-2">{sub}</p>
        )}
      </div>
    </div>
  )
}

/* ── Regular KPI card ───────────────────────────────────────────────────── */
function KpiCard({
  label, value, sub, delta, icon: Icon, color, onClick, active,
}: { label: string; value: string | number; sub: string; delta?: number; icon: React.ElementType; color: string; onClick?: () => void; active?: boolean }) {
  const hasD = delta !== undefined
  const up   = hasD && delta! >= 0
  const Tag = onClick ? 'button' : 'div'
  const tagExtraProps = onClick ? { type: 'button' as const, onClick } : {}
  return (
    <Tag
      {...tagExtraProps}
      className={`rounded-2xl p-5 flex flex-col justify-between min-h-[160px] flex-1 text-left w-full ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        background: 'var(--nm-bg)',
        boxShadow: active
          ? `-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark), 0 0 0 2px ${color}60`
          : '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
        border: `1px solid ${active ? color + '60' : 'var(--nm-border)'}`,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}15`, border: `1px solid ${color}28` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <ArrowUpRight className="w-4 h-4 text-white/20" />
      </div>

      <div>
        <p className="text-[40px] font-extrabold text-white leading-none tracking-tight">{value}</p>
        <p className="text-[11px] text-white/55 mt-2 font-medium">{label}</p>
        {hasD && (
          <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
            {up ? '↑' : '↓'} {Math.abs(delta!)} {sub}
          </div>
        )}
        {!hasD && <p className="text-[10px] text-white/30 mt-1.5">{sub}</p>}
      </div>
    </Tag>
  )
}

/* ── Main ───────────────────────────────────────────────────────────────── */
export function ClientesMetricas() {
  const [today] = useState(() => new Date())
  const todayMs = today.getTime()

  const [selYear,  setSelYear]  = useState(today.getFullYear())
  const [selMonth, setSelMonth] = useState(today.getMonth())
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [customStart, setCustomStart] = useState(() => toDateInputValue(startOf(today.getFullYear(), today.getMonth())))
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(today))

  const { data: kanbanCols,   isLoading: loadK } = useColumns('kanban')
  const { data: mentoriaCols, isLoading: loadM } = useColumns('mentoria')

  /* ── Tasks ──────────────────────────────────────────────────────────── */
  // Todos os cards de cada quadro, com a origem marcada — sem filtrar coluna por título:
  // churnedAt agora é o sinal confiável de saída, então o histórico precisa enxergar
  // também quem está na coluna Encerrado (senão a saída some das métricas).
  const kanbanAllTasks = useMemo<ClienteTask[]>(() => {
    if (!kanbanCols) return []
    return kanbanCols.flatMap(c => c.tasks).map(t => ({ ...t, origem: 'Processos' as const }))
  }, [kanbanCols])

  const mentoriaTasks = useMemo<ClienteTask[]>(() => {
    if (!mentoriaCols) return []
    return mentoriaCols.flatMap(c => c.tasks).map(t => ({ ...t, origem: 'Mentoria' as const }))
  }, [mentoriaCols])

  // "Clientes" = cards dos dois quadros combinados — usado nas métricas de entrada/saída/churn.
  const clienteTasks = useMemo(() => [...kanbanAllTasks, ...mentoriaTasks], [kanbanAllTasks, mentoriaTasks])

  // Ativos só do Processos, sem os encerrados — usado nas seções ADS & Promoção e Por Etapa,
  // que são conceitos específicos daquele quadro.
  const kanbanAtivos = useMemo(() => kanbanAllTasks.filter(t => !t.churnedAt), [kanbanAllTasks])

  /* ── Date ranges ─────────────────────────────────────────────────────── */
  const totalStart = useMemo(() => {
    const timestamps = clienteTasks
      .map((task) => new Date(task.createdAt).getTime())
      .filter(Number.isFinite)
    return timestamps.length ? new Date(Math.min(...timestamps)) : startOf(today.getFullYear(), today.getMonth())
  }, [clienteTasks, today])

  const periodRange = useMemo(() => {
    const todayEnd = endOfDay(toDateInputValue(today))

    if (periodMode === 'total') {
      return { start: totalStart, end: todayEnd, prevStart: null, prevEnd: null, label: 'Todo o histórico' }
    }

    const rawStart = periodMode === 'custom' && customStart
      ? startOfDay(customStart)
      : startOf(selYear, selMonth)
    const rawEnd = periodMode === 'custom' && customEnd
      ? endOfDay(customEnd)
      : endOf(selYear, selMonth)
    const [start, end] = rawStart <= rawEnd ? [rawStart, rawEnd] : [startOfDay(customEnd), endOfDay(customStart)]
    const span = end.getTime() - start.getTime()
    const prevEnd = new Date(start.getTime() - 1)
    const prevStart = new Date(prevEnd.getTime() - span)

    return {
      start,
      end,
      prevStart,
      prevEnd,
      label: periodMode === 'custom' ? formatRange(start, end) : `${MESES_FULL[selMonth]} ${selYear}`,
    }
  }, [customEnd, customStart, periodMode, selMonth, selYear, today, totalStart])

  const { start, end, prevStart, prevEnd, label: periodLabel } = periodRange
  const hasComparison = Boolean(prevStart && prevEnd)

  /* ── KPI ─────────────────────────────────────────────────────────────── */
  const ativosAgora = useMemo(() => clienteTasks.filter(t => !t.churnedAt), [clienteTasks])
  const totalAtivos = ativosAgora.length

  const entradasPeriodo = useMemo(
    () => clienteTasks.filter(task => inRange(task.createdAt, start, end)),
    [clienteTasks, start, end],
  )
  const saidasPeriodo = useMemo(
    () => clienteTasks.filter(task => inRange(task.churnedAt, start, end)),
    [clienteTasks, start, end],
  )
  const prevEntradasPeriodo = useMemo(
    () => (prevStart && prevEnd
      ? clienteTasks.filter(task => inRange(task.createdAt, prevStart, prevEnd))
      : []),
    [clienteTasks, prevStart, prevEnd],
  )
  const prevSaidasPeriodo = useMemo(
    () => (prevStart && prevEnd
      ? clienteTasks.filter(task => inRange(task.churnedAt, prevStart, prevEnd))
      : []),
    [clienteTasks, prevStart, prevEnd],
  )

  const crescimento = entradasPeriodo.length - saidasPeriodo.length

  const ativosInicioPeriodo = useMemo(() => {
    const reference = new Date(start.getTime() - 1)
    return clienteTasks.filter(task => {
      const createdAt = new Date(task.createdAt)
      const churnedAt = task.churnedAt ? new Date(task.churnedAt) : null
      return createdAt <= reference && (!churnedAt || churnedAt > reference)
    }).length
  }, [clienteTasks, start])

  const churnBase = periodMode === 'total' ? clienteTasks.length : ativosInicioPeriodo
  const churnRate = churnBase > 0 ? +((saidasPeriodo.length / churnBase) * 100).toFixed(1) : 0

  const prevChurnBase = useMemo(() => {
    if (!prevStart) return 0
    const reference = new Date(prevStart.getTime() - 1)
    return clienteTasks.filter(task => {
      const createdAt = new Date(task.createdAt)
      const churnedAt = task.churnedAt ? new Date(task.churnedAt) : null
      return createdAt <= reference && (!churnedAt || churnedAt > reference)
    }).length
  }, [clienteTasks, prevStart])
  const prevChurnRate = hasComparison && prevChurnBase > 0
    ? +((prevSaidasPeriodo.length / prevChurnBase) * 100).toFixed(1)
    : null

  /* ── Gráfico de barras: últimos 6 meses ──────────────────────────────── */
  const barData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      let m = end.getMonth() - (5 - i), y = end.getFullYear()
      while (m < 0) { m += 12; y-- }
      const s = startOf(y, m), e = endOf(y, m)
      return {
        mes: MESES_ABR[m],
        Entradas: clienteTasks.filter(t => inRange(t.createdAt, s, e)).length,
        Saídas:   clienteTasks.filter(t => inRange(t.churnedAt, s, e)).length,
      }
    })
  }, [clienteTasks, end])

  /* ── Por etapa (Processos) ─────────────────────────────────────────────── */
  const porEtapa = useMemo(() => {
    if (!kanbanCols) return []
    return kanbanCols
      .filter(c => !isChurnColumnTitle(c.title))
      .map(c => ({ name: c.title, count: c.tasks.filter(t => !t.churnedAt).length }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [kanbanCols])
  const maxEtapa = Math.max(...porEtapa.map(e => e.count), 1)

  /* ── ADS & Promoção (Processos) ────────────────────────────────────────── */
  const adsAtivos   = kanbanAtivos.filter(t =>  t.adsAtivo).length
  const promoAtivas = kanbanAtivos.filter(t =>  t.promocaoAtiva).length
  const ambos       = kanbanAtivos.filter(t =>  t.adsAtivo && t.promocaoAtiva).length
  const semAtivacao = kanbanAtivos.filter(t => !t.adsAtivo && !t.promocaoAtiva).length

  /* ── Contratos vencendo ──────────────────────────────────────────────── */
  const in60 = todayMs + 60 * 24 * 60 * 60 * 1000
  const vencendo = useMemo(() =>
    mentoriaTasks
      .filter(t => { if (!t.dueDate || t.churnedAt) return false; const d = new Date(t.dueDate).getTime(); return d >= todayMs && d <= in60 })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
  [mentoriaTasks, todayMs, in60])

  /* ── Lista expandível — quem entrou / quem saiu ───────────────────────── */
  const [expandedKpi, setExpandedKpi] = useState<'entradas' | 'saidas' | null>(null)
  const expandedList = expandedKpi === 'entradas' ? entradasPeriodo : expandedKpi === 'saidas' ? saidasPeriodo : []

  /* ── Nav mês ─────────────────────────────────────────────────────────── */
  const isNow = selYear === today.getFullYear() && selMonth === today.getMonth()
  function prev() { if (selMonth === 0) { setSelYear(y => y-1); setSelMonth(11) } else setSelMonth(m => m-1) }
  function next() { if (isNow) return; if (selMonth === 11) { setSelYear(y => y+1); setSelMonth(0) } else setSelMonth(m => m+1) }

  /* ── Loading ─────────────────────────────────────────────────────────── */
  if (loadK || loadM) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
    </div>
  )

  /* ── Delta ativos vs mês anterior ─────────────────────────────────────── */
  const deltaAtivos = hasComparison ? totalAtivos - ativosInicioPeriodo : undefined
  const periodSummary = periodMode === 'total'
    ? 'Dados de todo o histórico'
    : `Período: ${periodLabel}`
  const comparisonLabel = hasComparison ? 'vs período anterior' : 'todo o histórico'

  return (
    <div className="mf-workspace mf-metrics flex-1 overflow-y-auto p-5 lg:p-8 space-y-5" style={{ background: 'var(--nm-bg)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mf-eyebrow mb-2">Visão de carteira</p>
          <h1 className="text-[20px] font-extrabold text-white tracking-tight"
            style={{ fontFamily: 'var(--font-heading)' }}>
            Dashboard de Clientes
          </h1>
          <p className="text-[12px] text-white/40 mt-0.5">
            {periodSummary} — Processos + Mentoria
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl p-2"
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-4px -4px 10px var(--nm-light), 4px 4px 10px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}>
          <div className="grid grid-cols-3 gap-1 rounded-lg p-1" style={{ background: 'rgba(127,127,127,0.08)' }} role="group" aria-label="Tipo de período">
            {([
              ['month', 'Mês'],
              ['custom', 'Datas'],
              ['total', 'Total'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPeriodMode(mode)}
                aria-pressed={periodMode === mode}
                className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  periodMode === mode
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'text-white/45 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {periodMode === 'custom' && (
            <div className="flex items-center gap-2">
              <label className="flex min-w-0 items-center gap-1.5 text-[10px] text-white/45">
                <span>De</span>
                <input
                  type="date"
                  value={customStart}
                  max={customEnd || undefined}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="min-w-0 rounded-md border px-2 py-1 text-[11px] font-medium text-white outline-none"
                  style={{ background: 'var(--nm-bg)', borderColor: 'var(--nm-border)', colorScheme: 'dark' }}
                  required
                />
              </label>
              <label className="flex min-w-0 items-center gap-1.5 text-[10px] text-white/45">
                <span>Até</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart || undefined}
                  max={toDateInputValue(today)}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="min-w-0 rounded-md border px-2 py-1 text-[11px] font-medium text-white outline-none"
                  style={{ background: 'var(--nm-bg)', borderColor: 'var(--nm-border)', colorScheme: 'dark' }}
                  required
                />
              </label>
            </div>
          )}

          {periodMode === 'total' && (
            <p className="px-1 py-0.5 text-[11px] font-medium text-white/55">{periodLabel}</p>
          )}
        </div>

        {/* Month picker */}
        <div className={`flex items-center gap-1 rounded-xl px-1 py-1 ${periodMode === 'month' ? '' : 'hidden'}`}
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-4px -4px 10px var(--nm-light), 4px 4px 10px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}>
          <button onClick={prev} aria-label="Ver mês anterior"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/45 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[13px] font-semibold text-white px-3 min-w-[140px] text-center select-none">
            {MESES_FULL[selMonth]} {selYear}
          </span>
          <button onClick={next} disabled={isNow} aria-label="Ver mês seguinte"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer
              ${isNow ? 'text-white/15 cursor-not-allowed' : 'text-white/45 hover:text-white hover:bg-white/[0.06]'}`}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Featured */}
        <FeaturedCard
          label="Clientes ativos"
          value={totalAtivos}
          delta={deltaAtivos}
          sub={hasComparison ? comparisonLabel : 'base ativa neste momento'}
          icon={Users}
        />
        <KpiCard
          label={periodMode === 'total' ? 'Entradas totais' : 'Entradas no período'}
          value={entradasPeriodo.length}
          sub={hasComparison ? comparisonLabel : 'Criadas desde o início'}
          delta={hasComparison ? entradasPeriodo.length - prevEntradasPeriodo.length : undefined}
          icon={UserPlus}
          color="#10b981"
          active={expandedKpi === 'entradas'}
          onClick={() => setExpandedKpi(k => k === 'entradas' ? null : 'entradas')}
        />
        <KpiCard
          label={periodMode === 'total' ? 'Saídas totais' : 'Saídas no período'}
          value={saidasPeriodo.length}
          sub={hasComparison ? comparisonLabel : 'Encerradas desde o início'}
          delta={hasComparison && saidasPeriodo.length > 0
            ? -(saidasPeriodo.length - prevSaidasPeriodo.length)
            : undefined}
          icon={UserMinus}
          color="#f43f5e"
          active={expandedKpi === 'saidas'}
          onClick={() => setExpandedKpi(k => k === 'saidas' ? null : 'saidas')}
        />
        <KpiCard
          label="Churn rate"
          value={`${churnRate}%`}
          sub={hasComparison && prevChurnRate !== null ? comparisonLabel : 'Saídas sobre a base do período'}
          delta={hasComparison && prevChurnRate !== null && prevChurnRate !== churnRate
            ? -(churnRate - prevChurnRate)
            : undefined}
          icon={Percent}
          color="#f59e0b"
        />
      </div>

      {/* ── Lista expandível: quem entrou / quem saiu ──────────────────────── */}
      {expandedKpi && (
        <div className="rounded-2xl p-5"
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[14px] font-bold text-white">
                {expandedKpi === 'entradas' ? 'Quem entrou' : 'Quem saiu'}
              </p>
              <p className="text-[11px] text-white/35 mt-0.5">{periodLabel} · Processos + Mentoria</p>
            </div>
            <button
              onClick={() => setExpandedKpi(null)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors"
              aria-label="Fechar lista"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {expandedList.length === 0 ? (
            <p className="text-[12px] text-white/25 text-center py-8">
              Ninguém {expandedKpi === 'entradas' ? 'entrou' : 'saiu'} nesse período.
            </p>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-0.5">
              {expandedList.map(t => {
                const eventDate = expandedKpi === 'entradas' ? t.createdAt : t.churnedAt
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: expandedKpi === 'entradas' ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
                        color: expandedKpi === 'entradas' ? '#10b981' : '#f43f5e',
                      }}>
                      {t.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white truncate">{t.title}</p>
                      <p className="text-[10px] text-white/35">
                        {t.origem}
                        {expandedKpi === 'saidas' && t.churnReason ? ` · ${t.churnReason}` : ''}
                      </p>
                    </div>
                    <span className="text-[11px] text-white/35 shrink-0">
                      {eventDate ? new Date(eventDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Middle Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">

        {/* Bar chart — evolução 6 meses */}
        <div className="col-span-1 rounded-2xl p-5 xl:col-span-5"
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[14px] font-bold text-white">Evolução Mensal</p>
              <p className="text-[11px] text-white/35 mt-0.5">entradas e saídas — 6 meses</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-white/40">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />Entradas
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-white/40">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />Saídas
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill:'rgba(255,255,255,0.38)', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'rgba(255,255,255,0.38)', fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={ChartTip} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="Entradas" name="Entradas" fill="#6366f1" radius={[5,5,0,0]} maxBarSize={28} />
              <Bar dataKey="Saídas"   name="Saídas"   fill="#f43f5e" radius={[5,5,0,0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ADS & Promoção */}
        <div className="col-span-1 rounded-2xl p-5 xl:col-span-3"
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}>
          <p className="text-[14px] font-bold text-white">ADS & Promoção</p>
          <p className="text-[11px] text-white/35 mt-0.5 mb-5">{kanbanAtivos.length} clientes ativos — Processos</p>

          <div className="space-y-4">
            {/* ADS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[12px] font-semibold text-white">ADS</span>
                </div>
                <span className="text-[18px] font-bold text-white">{adsAtivos}
                  <span className="text-[11px] text-white/30 font-normal ml-1">/ {kanbanAtivos.length}</span>
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: kanbanAtivos.length ? `${(adsAtivos/kanbanAtivos.length)*100}%` : '0%' }} />
              </div>
              <p className="text-[10px] text-white/25 mt-1">{kanbanAtivos.length ? ((adsAtivos/kanbanAtivos.length)*100).toFixed(0) : 0}% da base</p>
            </div>

            {/* Promoção */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Megaphone className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-[12px] font-semibold text-white">Promoção</span>
                </div>
                <span className="text-[18px] font-bold text-white">{promoAtivas}
                  <span className="text-[11px] text-white/30 font-normal ml-1">/ {kanbanAtivos.length}</span>
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full bg-amber-500 transition-all duration-700"
                  style={{ width: kanbanAtivos.length ? `${(promoAtivas/kanbanAtivos.length)*100}%` : '0%' }} />
              </div>
              <p className="text-[10px] text-white/25 mt-1">{kanbanAtivos.length ? ((promoAtivas/kanbanAtivos.length)*100).toFixed(0) : 0}% da base</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-3" style={{ borderTop:'1px solid var(--nm-border)' }}>
              <div className="rounded-xl p-3" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[20px] font-bold text-white">{ambos}</p>
                <p className="text-[10px] text-white/35 mt-1">ADS + Promo</p>
              </div>
              <div className="rounded-xl p-3" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[20px] font-bold text-white">{semAtivacao}</p>
                <p className="text-[10px] text-white/35 mt-1">Sem ativação</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contratos Vencendo */}
        <div className="col-span-1 rounded-2xl p-5 xl:col-span-4"
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[14px] font-bold text-white">Contratos Vencendo</p>
            {vencendo.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                <AlertTriangle className="w-3 h-3" />{vencendo.length}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/35 mb-4">Mentoria — próximos 60 dias</p>

          {vencendo.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[180px] gap-2">
              <BookOpen className="w-9 h-9 text-white/08" />
              <p className="text-[12px] text-white/25">Nenhum contrato vencendo</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[220px] pr-0.5">
              {vencendo.map(t => {
                const due = new Date(t.dueDate!)
                const days = Math.ceil((due.getTime() - todayMs) / 86400000)
                const urgent = days <= 14
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{
                      background: urgent ? 'rgba(244,63,94,0.06)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${urgent ? 'rgba(244,63,94,0.18)' : 'rgba(255,255,255,0.07)'}`,
                    }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: urgent ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.07)', color: urgent ? '#f43f5e' : 'rgba(255,255,255,0.5)' }}>
                      {t.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-white truncate">{t.title}</p>
                      <p className="text-[10px] text-white/35">
                        {due.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}
                      </p>
                    </div>
                    {/* Status badge — estilo Donezo */}
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${
                      urgent
                        ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                        : 'text-amber-400 bg-amber-500/10 border border-amber-500/15'
                    }`}>
                      {urgent ? 'Urgente' : `${days}d`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">

        {/* Por Etapa */}
        <div className="col-span-1 rounded-2xl p-5 xl:col-span-8"
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}>
          <p className="text-[14px] font-bold text-white">Distribuição por Etapa</p>
          <p className="text-[11px] text-white/35 mt-0.5 mb-5">clientes ativos por fase do funil — Processos</p>
          {porEtapa.length === 0 ? (
            <p className="text-[12px] text-white/25 text-center py-8">Sem dados</p>
          ) : (
            <div className="space-y-3.5">
              {porEtapa.map((e, i) => (
                <div key={e.name} className="flex items-center gap-4">
                  <span className="text-[12px] font-medium text-white/80 w-36 shrink-0 truncate">{e.name}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width:`${(e.count/maxEtapa)*100}%`, background: ETAPA_CORES[i % ETAPA_CORES.length] }} />
                  </div>
                  <span className="text-[13px] font-bold text-white w-6 text-right shrink-0">{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Crescimento líquido — card destaque secundário */}
        <div className="mf-metrics-inverse col-span-1 rounded-2xl p-6 flex flex-col justify-between xl:col-span-4"
          style={{
            background: crescimento >= 0
              ? 'linear-gradient(135deg, #052e16 0%, #0f1340 60%, #0c1a0e 100%)'
              : 'linear-gradient(135deg, #2d0a0a 0%, #0f1340 60%, #1a0808 100%)',
            boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
            border: `1px solid ${crescimento >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`,
          }}>
          <div>
            <p className="text-[13px] font-semibold text-white/60">Crescimento Líquido</p>
            <p className="text-[11px] text-white/30 mt-0.5">entradas − saídas no período</p>
          </div>
          <div>
            <p className={`text-[56px] font-extrabold leading-none tracking-tight ${crescimento >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {crescimento > 0 ? `+${crescimento}` : crescimento}
            </p>
            <div className={`flex items-center gap-1.5 mt-3 text-[12px] font-semibold ${crescimento >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {crescimento >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {crescimento >= 0 ? 'Crescimento positivo' : 'Retração no período'}
            </div>
            <p className="text-[10px] text-white/25 mt-1">
              {entradasPeriodo.length} entrada{entradasPeriodo.length !== 1 ? 's' : ''} · {saidasPeriodo.length} saída{saidasPeriodo.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
