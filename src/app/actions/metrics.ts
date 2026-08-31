'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isClosedCrmStage } from '@/lib/crm-pipeline'
import { normalizeDateToBrazilDay } from '@/lib/date-range'
import { prisma } from '@/lib/prisma'

type DashboardDateRange = { start: Date; end: Date }
type DailyPoint = {
  date: Date
  novosLeads: number
  agendadas: number
  realizadas: number
  faltas: number
  vendas: number
}

function toValidRange(startDate?: Date, endDate?: Date): DashboardDateRange {
  const end = endDate ? new Date(endDate) : new Date()
  const start = startDate ? new Date(startDate) : new Date(end)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Período inválido para o dashboard.')
  }

  return start <= end ? { start, end } : { start: end, end: start }
}

function addToDay(
  days: Map<string, DailyPoint>,
  date: Date,
  field: Exclude<keyof DailyPoint, 'date'>
) {
  const day = normalizeDateToBrazilDay(date)
  const key = day.toISOString()
  const entry: DailyPoint = days.get(key) ?? {
    date: day,
    novosLeads: 0,
    agendadas: 0,
    realizadas: 0,
    faltas: 0,
    vendas: 0,
  }

  entry[field] += 1
  days.set(key, entry)
}

/**
 * Consolida somente eventos reais da operação: CRM, WhatsApp e Agenda.
 * DashboardMetric e SdrDailyLog ficam preservados como legado, mas não entram
 * mais na visualização comercial para evitar qualquer lançamento manual.
 */
export async function getDashboardData(startDate?: Date, endDate?: Date) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  const { start, end } = toValidRange(startDate, endDate)
  const inRange = { gte: start, lte: end }

  const [createdLeads, closedLeads, events, messageCounts, contactedLeads, stages] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: inRange },
      select: { createdAt: true },
    }),
    prisma.lead.findMany({
      where: { closedAt: inRange },
      select: { closedAt: true, value: true },
    }),
    prisma.agendaEvent.findMany({
      where: {
        leadId: { not: null },
        startsAt: inRange,
      },
      select: { startsAt: true, status: true },
    }),
    prisma.message.groupBy({
      by: ['direction'],
      where: {
        createdAt: inRange,
        NOT: { whatsappMessageId: { startsWith: 'note-' } },
      },
      _count: { _all: true },
    }),
    prisma.message.findMany({
      where: {
        direction: 'OUTBOUND',
        createdAt: inRange,
        NOT: { whatsappMessageId: { startsWith: 'note-' } },
      },
      distinct: ['leadId'],
      select: { leadId: true },
    }),
    prisma.leadStage.findMany({
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        _count: { select: { leads: true } },
      },
    }),
  ])

  const days = new Map<string, DailyPoint>()

  for (const lead of createdLeads) addToDay(days, lead.createdAt, 'novosLeads')

  let meetingsScheduled = 0
  let meetingsCompleted = 0
  let meetingsNoShow = 0
  let meetingsNotHeld = 0
  for (const event of events) {
    if (event.status === 'CANCELADA') continue

    meetingsScheduled += 1
    addToDay(days, event.startsAt, 'agendadas')
    if (event.status === 'REALIZADA') {
      meetingsCompleted += 1
      addToDay(days, event.startsAt, 'realizadas')
    }
    if (event.status === 'FALTA') {
      meetingsNoShow += 1
      addToDay(days, event.startsAt, 'faltas')
    }
    if (event.status === 'NAO_REALIZADA') meetingsNotHeld += 1
  }

  let revenue = 0
  let salesWithoutValue = 0
  for (const sale of closedLeads) {
    if (sale.closedAt) addToDay(days, sale.closedAt, 'vendas')
    if (typeof sale.value === 'number' && Number.isFinite(sale.value)) revenue += sale.value
    else salesWithoutValue += 1
  }

  const inboundMessages = messageCounts.find((item) => item.direction === 'INBOUND')?._count._all ?? 0
  const outboundMessages = messageCounts.find((item) => item.direction === 'OUTBOUND')?._count._all ?? 0
  const salesCount = closedLeads.length
  const newLeads = createdLeads.length
  const closedStageIds = new Set(stages.filter((stage) => isClosedCrmStage(stage.name)).map((stage) => stage.id))

  return {
    period: { start, end },
    generatedAt: new Date(),
    metrics: {
      newLeads,
      inboundMessages,
      outboundMessages,
      contactedLeads: contactedLeads.length,
      meetingsScheduled,
      meetingsCompleted,
      meetingsNoShow,
      meetingsNotHeld,
      salesCount,
      revenue,
      salesWithoutValue,
      leadToSaleRate: newLeads > 0 ? (salesCount / newLeads) * 100 : 0,
      meetingShowRate: meetingsScheduled > 0 ? (meetingsCompleted / meetingsScheduled) * 100 : 0,
      pipelineOpen: stages
        .filter((stage) => !closedStageIds.has(stage.id))
        .reduce((total, stage) => total + stage._count.leads, 0),
    },
    daily: Array.from(days.values()).sort((a, b) => a.date.getTime() - b.date.getTime()),
    pipeline: stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      color: stage.color,
      total: stage._count.leads,
      isClosed: closedStageIds.has(stage.id),
    })),
  }
}
