'use client'

import { useState, useMemo } from 'react'
import { useColumns } from '@/hooks/api'
import type { Task } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Users, UserPlus, UserMinus, Percent, ChevronLeft, ChevronRight,
  ArrowUpRight, Zap, Megaphone, BookOpen, AlertTriangle, Loader2,
  TrendingUp, TrendingDown,
} from 'lucide-react'

/* ── Constants ──────────────────────────────────────────────────────────── */
const EXCLUIDAS   = ['encerrado', 'cancelado', 'inativo', 'churned']
const MESES_ABR   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const ETAPA_CORES = ['#6366f1','#8b5cf6','#a855f7','#ec4899','#f59e0b','#10b981','#06b6d4']

/* ── Helpers ────────────────────────────────────────────────────────────── */
function isExcluded(t: string) { return EXCLUIDAS.some(ex => t.toLowerCase().includes(ex)) }
function startOf(y: number, m: number) { return new Date(y, m, 1) }
function endOf(y: number, m: number)   { return new Date(y, m + 1, 0, 23, 59, 59, 999) }
function inRange(d: string | null | undefined, s: Date, e: Date) {
  if (!d) return false; const dt = new Date(d); return dt >= s && dt <= e
}

/* ── Custom Tooltip ─────────────────────────────────────────────────────── */
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--nm-bg)', border: '1px solid var(--nm-border)',
      boxShadow: '-4px -4px 10px var(--nm-light), 4px 4px 10px var(--nm-dark)',
      borderRadius: 10, padding: '10px 14px',
    }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:p.fill, flexShrink:0 }} />
          <span style={{ color:'#fff', fontSize:13, fontWeight:700 }}>{p.value}</span>
          <span style={{ color:'rgba(255,255,255,0.38)', fontSize:11 }}>{p.name}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Featured KPI card (primeiro, destaque com gradiente) ───────────────── */
function FeaturedCard({
  label, value, sub, delta, icon: Icon,
}: { label: string; value: number; sub: string; delta: number; icon: React.ElementType }) {
  const up = delta >= 0
  return (
    <div
      className="rounded-2xl p-6 flex flex-col justify-between min-h-[160px]"
      style={{
        background: 'linear-gradient(135deg, #1a1f6e 0%, #0f1340 55%, #18114a 100%)',
        boxShadow: '-6px -6px 16px #1e2460, 6px 6px 16px #060924, inset 0 1px 0 rgba(120,150,255,0.15)',
        border: '1px solid rgba(120,150,255,0.28)',
        flex: '1.4 1 0',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>
          <Icon className="w-5 h-5 text-indigo-400" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-white/30" />
      </div>

      <div>
        <p className="text-[52px] font-extrabold text-white leading-none tracking-tight">{value}</p>
        <p className="text-[12px] text-white/60 mt-2 font-medium">{label}</p>
        <div className={`flex items-center gap-1 mt-2 text-[11px] font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
          {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {delta > 0 ? `+${delta}` : delta} {sub}
        </div>
      </div>
    </div>
  )
}

/* ── Regular KPI card ───────────────────────────────────────────────────── */
function KpiCard({
  label, value, sub, delta, icon: Icon, color,
}: { label: string; value: string | number; sub: string; delta?: number; icon: React.ElementType; color: string }) {
  const hasD = delta !== undefined
  const up   = hasD && delta! >= 0
  return (
    <div
      className="rounded-2xl p-5 flex flex-col justify-between min-h-[160px] flex-1"
      style={{
        background: 'var(--nm-bg)',
        boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
        border: '1px solid var(--nm-border)',
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
    </div>
  )
}

/* ── Main ───────────────────────────────────────────────────────────────── */
export function ClientesMetricas() {
  const today   = new Date()
  const todayMs = today.getTime()

  const [selYear,  setSelYear]  = useState(today.getFullYear())
  const [selMonth, setSelMonth] = useState(today.getMonth())

  const { data: kanbanCols,   isLoading: loadK } = useColumns('kanban')
  const { data: mentoriaCols, isLoading: loadM } = useColumns('mentoria')

  /* ── Tasks ──────────────────────────────────────────────────────────── */
  const kanbanTasks = useMemo(() => {
    if (!kanbanCols) return []
    return kanbanCols.filter(c => !isExcluded(c.title)).flatMap(c => c.tasks)
  }, [kanbanCols])

  const mentoriaTasks = useMemo(() => {
    if (!mentoriaCols) return []
    return mentoriaCols.flatMap(c => c.tasks)
  }, [mentoriaCols])

  /* ── Date ranges ─────────────────────────────────────────────────────── */
  const start    = startOf(selYear, selMonth)
  const end      = endOf(selYear, selMonth)
  const prevStart = startOf(selYear, selMonth - 1)
  const prevEnd   = endOf(selYear, selMonth - 1)

  /* ── KPI ─────────────────────────────────────────────────────────────── */
  const ativosAgora = useMemo(() => kanbanTasks.filter(t => !t.completedAt), [kanbanTasks])
  const totalAtivos = ativosAgora.length

  const entradasMes      = useMemo(() => kanbanTasks.filter(t => inRange(t.createdAt,   start, end)),      [kanbanTasks, start, end])
  const saidasMes        = useMemo(() => kanbanTasks.filter(t => inRange(t.completedAt, start, end)),      [kanbanTasks, start, end])
  const prevEntradasMes  = useMemo(() => kanbanTasks.filter(t => inRange(t.createdAt,   prevStart, prevEnd)), [kanbanTasks, prevStart, prevEnd])
  const prevSaidasMes    = useMemo(() => kanbanTasks.filter(t => inRange(t.completedAt, prevStart, prevEnd)), [kanbanTasks, prevStart, prevEnd])

  const crescimento     = entradasMes.length - saidasMes.length
  const prevCrescimento = prevEntradasMes.length - prevSaidasMes.length

  const ativosInicioMes = useMemo(() =>
    kanbanTasks.filter(t => {
      const cr = new Date(t.createdAt)
      const cp = t.completedAt ? new Date(t.completedAt) : null
      return cr <= prevEnd && (!cp || cp > prevEnd)
    }).length,
  [kanbanTasks, prevEnd])

  const churnRate     = ativosInicioMes > 0 ? +((saidasMes.length / ativosInicioMes) * 100).toFixed(1) : 0
  const prevChurnBase = useMemo(() =>
    kanbanTasks.filter(t => {
      const cr = new Date(t.createdAt)
      const cp = t.completedAt ? new Date(t.completedAt) : null
      return cr <= endOf(selYear, selMonth - 2) && (!cp || cp > endOf(selYear, selMonth - 2))
    }).length,
  [kanbanTasks, selYear, selMonth])
  const prevChurnRate = prevChurnBase > 0 ? +((prevSaidasMes.length / prevChurnBase) * 100).toFixed(1) : 0

  /* ── Gráfico de barras: últimos 6 meses ──────────────────────────────── */
  const barData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      let m = selMonth - (5 - i), y = selYear
      while (m < 0) { m += 12; y-- }
      const s = startOf(y, m), e = endOf(y, m)
      return {
        mes: MESES_ABR[m],
        Entradas: kanbanTasks.filter(t => inRange(t.createdAt,   s, e)).length,
        Saídas:   kanbanTasks.filter(t => inRange(t.completedAt, s, e)).length,
      }
    })
  }, [kanbanTasks, selYear, selMonth])

  /* ── Por etapa ───────────────────────────────────────────────────────── */
  const porEtapa = useMemo(() => {
    if (!kanbanCols) return []
    return kanbanCols
      .filter(c => !isExcluded(c.title))
      .map(c => ({ name: c.title, count: c.tasks.filter(t => !t.completedAt).length }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [kanbanCols])
  const maxEtapa = Math.max(...porEtapa.map(e => e.count), 1)

  /* ── ADS & Promoção ──────────────────────────────────────────────────── */
  const adsAtivos   = ativosAgora.filter(t =>  t.adsAtivo).length
  const promoAtivas = ativosAgora.filter(t =>  t.promocaoAtiva).length
  const ambos       = ativosAgora.filter(t =>  t.adsAtivo && t.promocaoAtiva).length
  const semAtivacao = ativosAgora.filter(t => !t.adsAtivo && !t.promocaoAtiva).length

  /* ── Contratos vencendo ──────────────────────────────────────────────── */
  const in60 = todayMs + 60 * 24 * 60 * 60 * 1000
  const vencendo = useMemo(() =>
    mentoriaTasks
      .filter(t => { if (!t.dueDate || t.completedAt) return false; const d = new Date(t.dueDate).getTime(); return d >= todayMs && d <= in60 })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
  [mentoriaTasks, todayMs, in60])

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
  const deltaAtivos = totalAtivos - ativosInicioMes

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ background: 'var(--nm-bg)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-extrabold text-white tracking-tight"
            style={{ fontFamily: 'var(--font-heading)' }}>
            Dashboard de Clientes
          </h1>
          <p className="text-[12px] text-white/40 mt-0.5">
            Visão consolidada — Processos + Mentoria
          </p>
        </div>

        {/* Month picker */}
        <div className="flex items-center gap-1 rounded-xl px-1 py-1"
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-4px -4px 10px var(--nm-light), 4px 4px 10px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}>
          <button onClick={prev}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/45 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[13px] font-semibold text-white px-3 min-w-[140px] text-center select-none">
            {MESES_FULL[selMonth]} {selYear}
          </span>
          <button onClick={next} disabled={isNow}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer
              ${isNow ? 'text-white/15 cursor-not-allowed' : 'text-white/45 hover:text-white hover:bg-white/[0.06]'}`}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div className="flex gap-4">
        {/* Featured */}
        <FeaturedCard
          label="Clientes ativos"
          value={totalAtivos}
          delta={deltaAtivos}
          sub="vs mês anterior"
          icon={Users}
        />
        <KpiCard
          label={`Entradas — ${MESES_ABR[selMonth]}`}
          value={entradasMes.length}
          sub={`${entradasMes.length - prevEntradasMes.length >= 0 ? '+' : ''}${entradasMes.length - prevEntradasMes.length} vs mês ant.`}
          delta={entradasMes.length - prevEntradasMes.length}
          icon={UserPlus}
          color="#10b981"
        />
        <KpiCard
          label={`Saídas — ${MESES_ABR[selMonth]}`}
          value={saidasMes.length}
          sub={`${saidasMes.length - prevSaidasMes.length >= 0 ? '+' : ''}${saidasMes.length - prevSaidasMes.length} vs mês ant.`}
          delta={saidasMes.length > 0 ? -(saidasMes.length - prevSaidasMes.length) : undefined}
          icon={UserMinus}
          color="#f43f5e"
        />
        <KpiCard
          label="Churn rate"
          value={`${churnRate}%`}
          sub={`${churnRate > prevChurnRate ? '+' : ''}${(churnRate - prevChurnRate).toFixed(1)}% vs mês ant.`}
          delta={prevChurnRate !== churnRate ? -(churnRate - prevChurnRate) : undefined}
          icon={Percent}
          color="#f59e0b"
        />
      </div>

      {/* ── Middle Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Bar chart — evolução 6 meses */}
        <div className="col-span-5 rounded-2xl p-5"
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
              <RTooltip content={<ChartTip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="Entradas" name="Entradas" fill="#6366f1" radius={[5,5,0,0]} maxBarSize={28} />
              <Bar dataKey="Saídas"   name="Saídas"   fill="#f43f5e" radius={[5,5,0,0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ADS & Promoção */}
        <div className="col-span-3 rounded-2xl p-5"
          style={{
            background: 'var(--nm-bg)',
            boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
            border: '1px solid var(--nm-border)',
          }}>
          <p className="text-[14px] font-bold text-white">ADS & Promoção</p>
          <p className="text-[11px] text-white/35 mt-0.5 mb-5">{totalAtivos} clientes ativos</p>

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
                  <span className="text-[11px] text-white/30 font-normal ml-1">/ {totalAtivos}</span>
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: totalAtivos ? `${(adsAtivos/totalAtivos)*100}%` : '0%' }} />
              </div>
              <p className="text-[10px] text-white/25 mt-1">{totalAtivos ? ((adsAtivos/totalAtivos)*100).toFixed(0) : 0}% da base</p>
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
                  <span className="text-[11px] text-white/30 font-normal ml-1">/ {totalAtivos}</span>
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full bg-amber-500 transition-all duration-700"
                  style={{ width: totalAtivos ? `${(promoAtivas/totalAtivos)*100}%` : '0%' }} />
              </div>
              <p className="text-[10px] text-white/25 mt-1">{totalAtivos ? ((promoAtivas/totalAtivos)*100).toFixed(0) : 0}% da base</p>
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
        <div className="col-span-4 rounded-2xl p-5"
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
      <div className="grid grid-cols-12 gap-4">

        {/* Por Etapa */}
        <div className="col-span-8 rounded-2xl p-5"
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
        <div className="col-span-4 rounded-2xl p-6 flex flex-col justify-between"
          style={{
            background: crescimento >= 0
              ? 'linear-gradient(135deg, #052e16 0%, #0f1340 60%, #0c1a0e 100%)'
              : 'linear-gradient(135deg, #2d0a0a 0%, #0f1340 60%, #1a0808 100%)',
            boxShadow: '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
            border: `1px solid ${crescimento >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`,
          }}>
          <div>
            <p className="text-[13px] font-semibold text-white/60">Crescimento Líquido</p>
            <p className="text-[11px] text-white/30 mt-0.5">entradas − saídas no mês</p>
          </div>
          <div>
            <p className={`text-[56px] font-extrabold leading-none tracking-tight ${crescimento >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {crescimento > 0 ? `+${crescimento}` : crescimento}
            </p>
            <div className={`flex items-center gap-1.5 mt-3 text-[12px] font-semibold ${crescimento >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {crescimento >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {crescimento >= 0 ? 'Crescimento positivo' : 'Retração no mês'}
            </div>
            <p className="text-[10px] text-white/25 mt-1">
              {entradasMes.length} entrada{entradasMes.length !== 1 ? 's' : ''} · {saidasMes.length} saída{saidasMes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
