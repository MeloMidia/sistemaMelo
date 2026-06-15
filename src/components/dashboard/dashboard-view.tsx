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

  // suppress unused warning — goals state is set from server but not read in JSX directly
  void goals

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
