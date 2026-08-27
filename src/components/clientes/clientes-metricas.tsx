'use client'

import { useState, useMemo } from 'react'
import { useColumns } from '@/hooks/api'
import type { Task } from '@/types'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Users, UserPlus, UserMinus, TrendingUp, Percent,
  ChevronLeft, ChevronRight, Zap, Megaphone, BookOpen,
  AlertTriangle, Loader2, ArrowUp, ArrowDown,
} from 'lucide-react'

const EXCLUIDAS = ['encerrado', 'cancelado', 'inativo', 'churned']
const MESES     = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const ETAPA_COLORS = ['#6366f1','#8b5cf6','#a855f7','#ec4899','#f59e0b','#10b981']

function isExcluded(title: string) {
  return EXCLUIDAS.some(ex => title.toLowerCase().includes(ex))
}
function startOf(y: number, m: number) { return new Date(y, m, 1) }
function endOf(y: number, m: number)   { return new Date(y, m + 1, 0, 23, 59, 59, 999) }
function inRange(dateStr: string | null | undefined, start: Date, end: Date) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d >= start && d <= end
}

// ── Custom tooltip ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--nm-bg)',
      border: '1px solid var(--nm-border)',
      boxShadow: '-4px -4px 10px var(--nm-light), 4px 4px 10px var(--nm-dark)',
      borderRadius: 10, padding: '10px 14px', minWidth: 130,
    }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{p.value}</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{p.name}</span>
        </div>
      ))}
    </div>
  )
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, color, delta,
}: {
  label: string; value: number | string; sub?: string
  icon: React.ElementType; color: string; delta?: number
}) {
  const isPos = delta !== undefined && delta > 0
  const isNeg = delta !== undefined && delta < 0
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 flex-1 min-w-0"
      style={{
        background: 'var(--nm-bg)',
        boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
        border: '1px solid var(--nm-border)',
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {delta !== undefined && (
          <span
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              isPos ? 'text-emerald-400 bg-emerald-500/10' :
              isNeg ? 'text-red-400 bg-red-500/10' :
              'text-white/40 bg-white/[0.05]'
            }`}
          >
            {isPos ? <ArrowUp className="w-3 h-3" /> : isNeg ? <ArrowDown className="w-3 h-3" /> : null}
            {Math.abs(delta)}
          </span>
        )}
      </div>
      <div>
        <p className="text-[30px] font-bold text-white leading-none tracking-tight">{value}</p>
        <p className="text-[11px] text-white/55 mt-2 font-medium">{label}</p>
        {sub && <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export function ClientesMetricas() {
  const today   = new Date()
  const todayMs = today.getTime()

  const [selYear,  setSelYear]  = useState(today.getFullYear())
  const [selMonth, setSelMonth] = useState(today.getMonth())

  const { data: kanbanCols,   isLoading: loadK } = useColumns('kanban')
  const { data: mentoriaCols, isLoading: loadM } = useColumns('mentoria')

  // ── Raw task lists ─────────────────────────────────────────────────────
  const kanbanTasks = useMemo<(Task & { _col: string })[]>(() => {
    if (!kanbanCols) return []
    return kanbanCols
      .filter(c => !isExcluded(c.title))
      .flatMap(c => c.tasks.map(t => ({ ...t, _col: c.title })))
  }, [kanbanCols])

  const mentoriaTasks = useMemo<Task[]>(() => {
    if (!mentoriaCols) return []
    return mentoriaCols.flatMap(c => c.tasks)
  }, [mentoriaCols])

  // ── Derived date boundaries ───────────────────────────────────────────
  const start   = startOf(selYear, selMonth)
  const end     = endOf(selYear, selMonth)
  const prevEnd = endOf(selYear, selMonth - 1)   // handles month underflow: new Date(y, -1, …) = Dec of y-1

  // ── KPI metrics ───────────────────────────────────────────────────────
  const ativosAgora = useMemo(
    () => kanbanTasks.filter(t => !t.completedAt),
    [kanbanTasks],
  )
  const totalAtivos = ativosAgora.length

  const entradasMes = useMemo(
    () => kanbanTasks.filter(t => inRange(t.createdAt, start, end)),
    [kanbanTasks, start, end],
  )

  const saidasMes = useMemo(
    () => kanbanTasks.filter(t => inRange(t.completedAt, start, end)),
    [kanbanTasks, start, end],
  )

  const crescimento = entradasMes.length - saidasMes.length

  const ativosInicioMes = useMemo(() => {
    return kanbanTasks.filter(t => {
      const created   = new Date(t.createdAt)
      const completed = t.completedAt ? new Date(t.completedAt) : null
      return created <= prevEnd && (!completed || completed > prevEnd)
    }).length
  }, [kanbanTasks, prevEnd])

  const churnRate = ativosInicioMes > 0
    ? ((saidasMes.length / ativosInicioMes) * 100).toFixed(1)
    : '0.0'

  // ── 6-month evolution chart ────────────────────────────────────────────
  const evolucaoData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      let m = selMonth - (5 - i)
      let y = selYear
      while (m < 0) { m += 12; y-- }
      const s = startOf(y, m)
      const e = endOf(y, m)
      return {
        mes: MESES[m],
        Entradas: kanbanTasks.filter(t => inRange(t.createdAt,    s, e)).length,
        Saídas:   kanbanTasks.filter(t => inRange(t.completedAt,  s, e)).length,
      }
    })
  }, [kanbanTasks, selYear, selMonth])

  // ── Por etapa ──────────────────────────────────────────────────────────
  const porEtapa = useMemo(() => {
    if (!kanbanCols) return []
    return kanbanCols
      .filter(c => !isExcluded(c.title))
      .map(c => ({ name: c.title, count: c.tasks.filter(t => !t.completedAt).length }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 7)
  }, [kanbanCols])
  const maxEtapa = Math.max(...porEtapa.map(e => e.count), 1)

  // ── ADS & Promoção ─────────────────────────────────────────────────────
  const adsAtivos   = ativosAgora.filter(t =>  t.adsAtivo).length
  const promoAtivas = ativosAgora.filter(t =>  t.promocaoAtiva).length
  const ambos       = ativosAgora.filter(t =>  t.adsAtivo && t.promocaoAtiva).length
  const semAtivacao = ativosAgora.filter(t => !t.adsAtivo && !t.promocaoAtiva).length

  // ── Contratos vencendo (Mentoria, 60 dias) ────────────────────────────
  const in60 = todayMs + 60 * 24 * 60 * 60 * 1000
  const vencendo = useMemo(() => {
    return mentoriaTasks
      .filter(t => {
        if (!t.dueDate || t.completedAt) return false
        const due = new Date(t.dueDate).getTime()
        return due >= todayMs && due <= in60
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
  }, [mentoriaTasks, todayMs, in60])

  // ── Month navigation ───────────────────────────────────────────────────
  const isCurrentMonth = selYear === today.getFullYear() && selMonth === today.getMonth()

  function prevMonth() {
    if (selMonth === 0) { setSelYear(y => y - 1); setSelMonth(11) }
    else setSelMonth(m => m - 1)
  }
  function nextMonth() {
    if (isCurrentMonth) return
    if (selMonth === 11) { setSelYear(y => y + 1); setSelMonth(0) }
    else setSelMonth(m => m + 1)
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (loadK || loadM) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="flex-1 overflow-y-auto p-6 space-y-5"
      style={{ background: 'var(--nm-bg)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1
            className="text-[17px] font-bold text-white"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Dashboard de Clientes
          </h1>
          <p className="text-[12px] text-white/40 mt-0.5">
            Processos + Mentoria — visão consolidada
          </p>
        </div>

        {/* Month picker */}
        <div
          className="flex items-center gap-1 rounded-xl px-1 py-1"
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-4px -4px 10px var(--nm-light), 4px 4px 10px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}
        >
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[13px] font-semibold text-white px-3 min-w-[140px] text-center select-none">
            {MESES_FULL[selMonth]} {selYear}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer
              ${isCurrentMonth ? 'text-white/15 cursor-not-allowed' : 'text-white/50 hover:text-white hover:bg-white/[0.06]'}`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div className="flex gap-4">
        <KpiCard
          label="Clientes ativos agora"
          value={totalAtivos}
          sub="base atual em Processos"
          icon={Users}
          color="#6366f1"
        />
        <KpiCard
          label={`Entradas em ${MESES[selMonth]}`}
          value={entradasMes.length}
          sub="novos clientes no mês"
          icon={UserPlus}
          color="#10b981"
          delta={entradasMes.length}
        />
        <KpiCard
          label={`Saídas em ${MESES[selMonth]}`}
          value={saidasMes.length}
          sub="clientes encerrados"
          icon={UserMinus}
          color="#f43f5e"
          delta={saidasMes.length > 0 ? -saidasMes.length : undefined}
        />
        <KpiCard
          label="Crescimento líquido"
          value={crescimento > 0 ? `+${crescimento}` : crescimento}
          sub="entradas − saídas"
          icon={TrendingUp}
          color={crescimento >= 0 ? '#10b981' : '#f43f5e'}
          delta={crescimento}
        />
        <KpiCard
          label="Churn rate"
          value={`${churnRate}%`}
          sub="saídas ÷ base início do mês"
          icon={Percent}
          color="#f59e0b"
        />
      </div>

      {/* ── Charts Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4">
        {/* Area chart: evolução mensal */}
        <div
          className="col-span-3 rounded-2xl p-5"
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[13px] font-semibold text-white">Evolução Mensal</p>
              <p className="text-[11px] text-white/35 mt-0.5">entradas e saídas — últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[11px] text-white/45">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                Entradas
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-white/45">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                Saídas
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={185}>
            <AreaChart data={evolucaoData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gEnt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSai" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="mes"
                tick={{ fill: 'rgba(255,255,255,0.38)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.38)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <RTooltip content={<ChartTooltip />} />
              <Area
                type="monotone" dataKey="Entradas" name="Entradas"
                stroke="#6366f1" strokeWidth={2.5}
                fill="url(#gEnt)" dot={false}
                activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
              />
              <Area
                type="monotone" dataKey="Saídas" name="Saídas"
                stroke="#f43f5e" strokeWidth={2.5}
                fill="url(#gSai)" dot={false}
                activeDot={{ r: 4, fill: '#f43f5e', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Por etapa */}
        <div
          className="col-span-2 rounded-2xl p-5"
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}
        >
          <p className="text-[13px] font-semibold text-white">Por Etapa</p>
          <p className="text-[11px] text-white/35 mt-0.5 mb-5">
            clientes ativos por fase do funil
          </p>

          {porEtapa.length === 0 ? (
            <p className="text-[12px] text-white/25 text-center py-10">Sem dados</p>
          ) : (
            <div className="space-y-4">
              {porEtapa.map((e, i) => (
                <div key={e.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] text-white font-medium truncate max-w-[75%]">
                      {e.name}
                    </span>
                    <span className="text-[12px] font-bold text-white">{e.count}</span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(e.count / maxEtapa) * 100}%`,
                        background: ETAPA_COLORS[i % ETAPA_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4">
        {/* ADS & Promoção */}
        <div
          className="col-span-2 rounded-2xl p-5"
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}
        >
          <p className="text-[13px] font-semibold text-white">ADS & Promoção</p>
          <p className="text-[11px] text-white/35 mt-0.5 mb-5">
            status atual — {totalAtivos} clientes ativos
          </p>

          <div className="space-y-5">
            {/* ADS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[12px] font-medium text-white">ADS ativo</span>
                </div>
                <div className="text-right">
                  <span className="text-[20px] font-bold text-white leading-none">{adsAtivos}</span>
                  <span className="text-[11px] text-white/35 ml-1">/ {totalAtivos}</span>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: totalAtivos ? `${(adsAtivos / totalAtivos) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-[10px] text-white/25 mt-1">
                {totalAtivos ? ((adsAtivos / totalAtivos) * 100).toFixed(0) : 0}% da base
              </p>
            </div>

            {/* Promoção */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Megaphone className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-[12px] font-medium text-white">Promoção ativa</span>
                </div>
                <div className="text-right">
                  <span className="text-[20px] font-bold text-white leading-none">{promoAtivas}</span>
                  <span className="text-[11px] text-white/35 ml-1">/ {totalAtivos}</span>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-700"
                  style={{ width: totalAtivos ? `${(promoAtivas / totalAtivos) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-[10px] text-white/25 mt-1">
                {totalAtivos ? ((promoAtivas / totalAtivos) * 100).toFixed(0) : 0}% da base
              </p>
            </div>

            {/* Mini stats */}
            <div
              className="grid grid-cols-2 gap-3 pt-4"
              style={{ borderTop: '1px solid var(--nm-border)' }}
            >
              <div
                className="rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p className="text-[22px] font-bold text-white leading-none">{ambos}</p>
                <p className="text-[10px] text-white/35 mt-1.5">ADS + Promo</p>
              </div>
              <div
                className="rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p className="text-[22px] font-bold text-white leading-none">{semAtivacao}</p>
                <p className="text-[10px] text-white/35 mt-1.5">Sem ativação</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contratos Vencendo — Mentoria */}
        <div
          className="col-span-3 rounded-2xl p-5"
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[13px] font-semibold text-white">Contratos Vencendo</p>
            {vencendo.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-medium">
                <AlertTriangle className="w-3 h-3" />
                {vencendo.length} alerta{vencendo.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/35 mb-4">Mentoria — próximos 60 dias</p>

          {vencendo.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2.5">
              <BookOpen className="w-9 h-9 text-white/10" />
              <p className="text-[12px] text-white/25">Nenhum contrato vencendo nos próximos 60 dias</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[200px] pr-1">
              {vencendo.map(t => {
                const due      = new Date(t.dueDate!)
                const daysLeft = Math.ceil((due.getTime() - todayMs) / (1000 * 60 * 60 * 24))
                const isUrgent = daysLeft <= 14
                const initial  = t.title.charAt(0).toUpperCase()
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{
                      background: isUrgent ? 'rgba(244,63,94,0.06)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isUrgent ? 'rgba(244,63,94,0.18)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: isUrgent ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.07)',
                        color: isUrgent ? '#f43f5e' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-white truncate">{t.title}</p>
                      <p className="text-[10px] text-white/35">
                        Vence {due.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <span
                      className={`text-[12px] font-bold px-3 py-1 rounded-lg shrink-0 ${
                        isUrgent
                          ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                          : 'text-amber-400 bg-amber-500/10 border border-amber-500/15'
                      }`}
                    >
                      {daysLeft}d
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
