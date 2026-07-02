'use server'

import { prisma } from '@/lib/prisma'
import { normalizeDateToMidnight } from '@/lib/date-range'

export type SdrLogData = {
  leadsWhatsapp: number
  agendadas: number
  realizadas: number
  faltaLead: number
  naoRealizada: number
}

export async function upsertSdrLog(date: Date, data: SdrLogData) {
  const normalizedDate = normalizeDateToMidnight(new Date(date))
  return prisma.sdrDailyLog.upsert({
    where: { date: normalizedDate },
    create: { date: normalizedDate, ...data },
    update: data,
  })
}

export async function getSdrLogs(startDate: Date, endDate: Date) {
  // Logs are stored at UTC midnight; normalize start to avoid off-by-3h exclusion in Brazil (UTC-3)
  const utcStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()))
  return prisma.sdrDailyLog.findMany({
    where: { date: { gte: utcStart, lte: new Date(endDate) } },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      leadsWhatsapp: true,
      agendadas: true,
      realizadas: true,
      faltaLead: true,
      naoRealizada: true,
    },
  })
}

export async function getSdrLogByDate(date: Date) {
  const normalizedDate = normalizeDateToMidnight(new Date(date))
  return prisma.sdrDailyLog.findUnique({
    where: { date: normalizedDate },
    select: {
      leadsWhatsapp: true,
      agendadas: true,
      realizadas: true,
      faltaLead: true,
      naoRealizada: true,
    },
  })
}
