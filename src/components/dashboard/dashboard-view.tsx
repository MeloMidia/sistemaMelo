'use client'

import { useState } from 'react'
import {
  Activity,
  BadgeDollarSign,
  CalendarCheck2,
  CircleAlert,
  CircleCheckBig,
  Loader2,
  Radio,
  Target,
  UserRoundCheck,
  UserRoundPlus,
} from 'lucide-react'
import { type DateRange, type PeriodKey } from '@/lib/date-range'
import { useDashboardData, useDashboardPrev, type DashboardData } from '@/hooks/api'
import { KpiCard, type KpiDelta } from './kpi-card'
import { PeriodSelector } from './period-selector'
import { FunnelChart } from './funnel-chart'
import { DailyLineChart } from './daily-line-chart'

type MetricTotals = DashboardData['metrics']

const EMPTY_METRICS: MetricTotals = {
  newLeads: 0,
  inboundMessages: 0,
  outboundMessages: 0,
  contactedLeads: 0,
  meetingsScheduled: 0,
  meetingsCompleted: 0,
  meetingsNoShow: 0,
  meetingsNotHeld: 0,
  salesCount: 0,
  revenue: 0,
  salesWithoutValue: 0,
  leadToSaleRate: 0,
  meetingShowRate: 0,
  pipelineOpen: 0,
}

function defaultCustomRange(): DateRange {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 7)
  return { start, end }
}

function calcDelta(current: number, previous: number | null): KpiDelta | undefined {
  if (previous === null || previous === 0) return undefined
  const pct = ((current - previous) / previous) * 100
  return {
    value: `${Math.abs(pct).toFixed(0)}%`,
    direction: pct > 1 ? 'up' : pct < -1 ? 'down' : 'neutral',
  }
}

function formatMoney(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR')
}

function formatGoalLabel(value: number) {
  return value % 1000 === 0 ? `${value / 1000}K` : formatMoney(value)
}

const REVENUE_GOAL_1 = 50000
const REVENUE_GOAL_2 = 65000
const REVENUE_GOAL_3 = 80000

export function DashboardView() {
  const [period, setPeriod] = useState<PeriodKey>('this-month')
  const [showComparison, setShowComparison] = useState(true)
  const [customRange, setCustomRange] = useState<DateRange>(defaultCustomRange)

  const { data: currentData, isLoading, isFetching } = useDashboardData(period, customRange)
  const { data: previousData } = useDashboardPrev(period, showComparison, customRange)

  const metrics = currentData?.metrics ?? EMPTY_METRICS
  const previous = previousData?.metrics ?? null
  const pipeline = currentData?.pipeline ?? []
  const maxPipelineStage = Math.max(...pipeline.map((stage) => stage.total), 1)

  const revenueActiveGoal =
    metrics.revenue >= REVENUE_GOAL_2 ? REVENUE_GOAL_3 : metrics.revenue >= REVENUE_GOAL_1 ? REVENUE_GOAL_2 : REVENUE_GOAL_1
  const revenueGoalPercent = revenueActiveGoal > 0 ? Math.min((metrics.revenue / revenueActiveGoal) * 100, 100) : 0
  const revenueFillPercent = Math.min((metrics.revenue / REVENUE_GOAL_3) * 100, 100)
  const revenueMarker1 = (REVENUE_GOAL_1 / REVENUE_GOAL_3) * 100
  const revenueMarker2 = (REVENUE_GOAL_2 / REVENUE_GOAL_3) * 100

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-[#2854DF]" />
      </div>
    )
  }

  return (
    <div className="mf-workspace custom-scrollbar flex-1 overflow-y-auto p-5 lg:p-8">
      <div className="mx-auto max-w-[1440px] space-y-6 pb-10">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="mf-eyebrow mb-2">Painel comercial</p>
            <h1 className="text-3xl font-bold tracking-[-0.045em] text-[#151817]">Ritmo de vendas</h1>
            <p className="mt-1 text-sm text-[#6C716E]">
              Leitura automática do CRM, WhatsApp e Agenda no período selecionado.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-full border border-[#D7E6DD] bg-[#F5FBF7] px-3 py-1.5 text-xs font-medium text-[#286A4B] xl:self-auto">
            <span className={`size-2 rounded-full bg-[#35A66F] ${isFetching ? 'animate-pulse' : ''}`} />
            Atualiza automaticamente a cada 30 segundos
          </div>
        </header>

        <div className="flex flex-col justify-between gap-3 border-y border-[#EDF0EB] py-3 sm:flex-row sm:items-end">
          <PeriodSelector
            period={period}
            showComparison={showComparison}
            customRange={customRange}
            onPeriodChange={setPeriod}
            onComparisonChange={setShowComparison}
            onCustomRangeChange={setCustomRange}
          />
          <p className="flex items-center gap-1.5 text-xs text-[#6C716E]">
            <Radio className="h-3.5 w-3.5 text-[#35A66F]" />
            Sem lançamento manual de métricas
          </p>
        </div>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.45fr_0.8fr]">
          <div className="mf-hero relative overflow-hidden rounded-3xl p-6 sm:p-7">
            <div className="absolute -right-12 -top-16 size-56 rounded-full bg-[#35A66F]/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-32 w-2/3 bg-[radial-gradient(ellipse_at_bottom_right,rgba(40,84,223,0.26),transparent_72%)]" />
            <div className="relative flex h-full flex-col justify-between gap-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#AFC0FF]">Faturamento confirmado</p>
                  <p className="mt-3 text-4xl font-bold tracking-[-0.055em] text-white tabular-nums sm:text-5xl">
                    {formatMoney(metrics.revenue)}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Soma dos valores dos leads movidos para <strong className="font-semibold text-slate-200">Fechados</strong>.
                  </p>
                </div>
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-[#AFC0FF]">
                  <BadgeDollarSign className="h-5 w-5" />
                </div>
              </div>

              <div className="w-full sm:max-w-md">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    Meta atual <strong className="font-semibold text-white">{formatMoney(revenueActiveGoal)}</strong>
                  </span>
                  <span className="text-xs font-semibold text-[#9CE2B8] tabular-nums">{revenueGoalPercent.toFixed(0)}%</span>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#2854DF] to-[#35A66F] transition-[width] duration-700 ease-out"
                    style={{ width: `${revenueFillPercent}%` }}
                  />
                  <div className="absolute top-0 h-full w-px bg-white/25" style={{ left: `${revenueMarker1}%` }} />
                  <div className="absolute top-0 h-full w-px bg-white/25" style={{ left: `${revenueMarker2}%` }} />
                </div>
                <div className="relative mt-1.5 h-4 w-full text-[10px] font-medium text-slate-500">
                  <span className="absolute left-0">R$ 0</span>
                  <span className="absolute" style={{ left: `calc(${revenueMarker1}% - 14px)` }}>
                    {formatGoalLabel(REVENUE_GOAL_1)}
                  </span>
                  <span className="absolute" style={{ left: `calc(${revenueMarker2}% - 14px)` }}>
                    {formatGoalLabel(REVENUE_GOAL_2)}
                  </span>
                  <span className="absolute right-0">{formatGoalLabel(REVENUE_GOAL_3)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4 sm:max-w-md">
                <div>
                  <p className="text-xs text-slate-400">Vendas fechadas</p>
                  <p className="mt-1 text-2xl font-semibold text-white tabular-nums">{formatNumber(metrics.salesCount)}</p>
                </div>
                <div className="border-l border-white/10 pl-4">
                  <p className="text-xs text-slate-400">Conversão do período</p>
                  <p className="mt-1 text-2xl font-semibold text-[#9CE2B8] tabular-nums">{metrics.leadToSaleRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mf-card rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="mf-label">Funil aberto agora</p>
                <p className="mt-1 text-sm text-[#6C716E]">Leads ainda em negociação</p>
              </div>
              <Activity className="h-5 w-5 text-[#2854DF]" />
            </div>
            <p className="mt-6 text-5xl font-bold tracking-[-0.055em] text-[#151817] tabular-nums">{formatNumber(metrics.pipelineOpen)}</p>
            <div className="mt-6 space-y-3 border-t border-[#EDF0EB] pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6C716E]">Leads atendidos</span>
                <strong className="font-semibold text-[#151817] tabular-nums">{formatNumber(metrics.contactedLeads)}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6C716E]">Reuniões realizadas</span>
                <strong className="font-semibold text-[#151817] tabular-nums">{formatNumber(metrics.meetingsCompleted)}</strong>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#151817]">O que aconteceu no período</h2>
              <p className="mt-0.5 text-xs text-[#6C716E]">Cada indicador vem de um evento real registrado no sistema.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard
              title="Novos leads"
              value={formatNumber(metrics.newLeads)}
              subtitle="Adicionados manualmente ao funil"
              icon={<UserRoundPlus className="h-4 w-4" />}
              colorVariant="blue"
              delta={calcDelta(metrics.newLeads, previous?.newLeads ?? null)}
            />
            <KpiCard
              title="Reuniões agendadas"
              value={formatNumber(metrics.meetingsScheduled)}
              subtitle="Eventos vinculados a leads"
              icon={<CalendarCheck2 className="h-4 w-4" />}
              colorVariant="default"
              delta={calcDelta(metrics.meetingsScheduled, previous?.meetingsScheduled ?? null)}
            />
            <KpiCard
              title="Vendas fechadas"
              value={formatNumber(metrics.salesCount)}
              subtitle="Entrada na etapa Fechados"
              icon={<CircleCheckBig className="h-4 w-4" />}
              colorVariant="amber"
              delta={calcDelta(metrics.salesCount, previous?.salesCount ?? null)}
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="mf-card rounded-2xl p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[#151817]">Saúde das reuniões</h2>
                <p className="mt-1 text-xs text-[#6C716E]">Status calculado a partir da Agenda.</p>
              </div>
              <Target className="h-5 w-5 text-[#2854DF]" />
            </div>
            <div className="grid grid-cols-3 divide-x divide-[#EDF0EB]">
              <div className="pr-4">
                <p className="text-2xl font-semibold text-[#151817] tabular-nums">{formatNumber(metrics.meetingsCompleted)}</p>
                <p className="mt-1 text-xs text-[#6C716E]">Realizadas</p>
              </div>
              <div className="px-4">
                <p className="text-2xl font-semibold text-[#BC4C4B] tabular-nums">{formatNumber(metrics.meetingsNoShow)}</p>
                <p className="mt-1 text-xs text-[#6C716E]">Faltas</p>
              </div>
              <div className="pl-4">
                <p className="text-2xl font-semibold text-[#2854DF] tabular-nums">{metrics.meetingShowRate.toFixed(1)}%</p>
                <p className="mt-1 text-xs text-[#6C716E]">Comparecimento</p>
              </div>
            </div>
            {metrics.meetingsNotHeld > 0 && (
              <p className="mt-5 flex items-center gap-1.5 rounded-xl bg-[#FFF7ED] px-3 py-2 text-xs text-[#9A5B16]">
                <CircleAlert className="h-3.5 w-3.5" />
                {formatNumber(metrics.meetingsNotHeld)} reunião(ões) marcada(s) como não realizada(s).
              </p>
            )}
          </div>

          <div className="mf-card rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[#151817]">Qualidade do registro</h2>
                <p className="mt-1 text-xs text-[#6C716E]">O painel só soma valores confirmados.</p>
              </div>
              <UserRoundCheck className="h-5 w-5 text-[#35A66F]" />
            </div>
            <div className="mt-6 rounded-2xl bg-[#F5FBF7] p-4">
              <p className="text-3xl font-bold tracking-[-0.04em] text-[#1C573A] tabular-nums">{formatNumber(metrics.salesWithoutValue)}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#467359]">
                venda(s) fechada(s) sem valor informado. Elas entram na quantidade de vendas, mas não no faturamento.
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.35fr]">
          <div className="mf-card rounded-2xl p-5">
            <h2 className="text-base font-semibold text-[#151817]">Funil de conversão</h2>
            <p className="mb-4 mt-1 text-xs text-[#6C716E]">Leads novos → Agenda → Realizadas → Fechadas</p>
            <FunnelChart
              novosLeads={metrics.newLeads}
              agendadas={metrics.meetingsScheduled}
              realizadas={metrics.meetingsCompleted}
              vendas={metrics.salesCount}
            />
          </div>
          <div className="mf-card rounded-2xl p-5">
            <h2 className="text-base font-semibold text-[#151817]">Evolução diária</h2>
            <p className="mb-4 mt-1 text-xs text-[#6C716E]">Novos leads, agenda, reuniões realizadas e vendas.</p>
            <DailyLineChart data={currentData?.daily ?? []} />
          </div>
        </section>

        <section className="mf-card rounded-2xl p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#151817]">Mapa atual do pipeline</h2>
              <p className="mt-1 text-xs text-[#6C716E]">Fotografia em tempo real das colunas do Kanban de leads.</p>
            </div>
            <span className="rounded-full bg-[#F2F3F0] px-2.5 py-1 text-xs font-semibold text-[#526158]">{formatNumber(pipeline.length)} etapas</span>
          </div>
          {pipeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#6C716E]">As etapas do CRM aparecerão aqui assim que o pipeline for carregado.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {pipeline.map((stage) => (
                <div key={stage.id} className="rounded-xl border border-[#E8ECE7] bg-[#FBFCFA] p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#262B28]">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="truncate">{stage.name}</span>
                    </span>
                    <strong className="text-sm text-[#151817] tabular-nums">{formatNumber(stage.total)}</strong>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E9EEE9]">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${(stage.total / maxPipelineStage) * 100}%`, backgroundColor: stage.color }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-[#7E8681]">{stage.isClosed ? 'Vendas confirmadas' : 'Leads na etapa'}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
