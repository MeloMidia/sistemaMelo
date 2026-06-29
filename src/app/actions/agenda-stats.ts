'use server'

import { prisma } from '@/lib/prisma'
import { normalizeDateToBrazilDay } from '@/lib/date-range'

export type AgendaMeetingDay = { date: Date; agendadas: number; realizadas: number }

export async function getAgendaMeetingStats(startDate: Date, endDate: Date) {
  const events = await prisma.agendaEvent.findMany({
    where: {
      leadId: { not: null },
      startsAt: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    select: { startsAt: true, status: true },
  })

  const byDay = new Map<string, AgendaMeetingDay>()
  let totalAgendadas = 0
  let totalRealizadas = 0

  for (const event of events) {
    // Reunião cancelada não conta como agendada nem aparece no gráfico diário.
    if (event.status === 'CANCELADA') continue

    totalAgendadas += 1
    const isRealizada = event.status === 'REALIZADA'
    if (isRealizada) totalRealizadas += 1

    const day = normalizeDateToBrazilDay(event.startsAt)
    const key = day.toISOString()
    const entry = byDay.get(key) ?? { date: day, agendadas: 0, realizadas: 0 }
    entry.agendadas += 1
    if (isRealizada) entry.realizadas += 1
    byDay.set(key, entry)
  }

  const daily = Array.from(byDay.values()).sort((a, b) => a.date.getTime() - b.date.getTime())

  return { totalAgendadas, totalRealizadas, daily }
}
