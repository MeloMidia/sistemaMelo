export type PeriodKey = 'this-month' | 'last-month' | 'last-30' | 'last-90' | 'custom'

export type DateRange = { start: Date; end: Date }

export function getDateRange(period: PeriodKey, customRange?: DateRange): DateRange {
  if (period === 'custom' && customRange) {
    const start = new Date(customRange.start)
    start.setHours(0, 0, 0, 0)
    const end = new Date(customRange.end)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  const now = new Date()

  if (period === 'this-month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    }
  }

  if (period === 'last-month') {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1
    return {
      start: new Date(y, m, 1),
      end: new Date(y, m + 1, 0, 23, 59, 59, 999),
    }
  }

  if (period === 'last-30') {
    const start = new Date(now)
    start.setDate(now.getDate() - 30)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  // last-90
  const start = new Date(now)
  start.setDate(now.getDate() - 90)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export function getPreviousPeriodRange(range: DateRange): DateRange {
  const diffMs = range.end.getTime() - range.start.getTime() + 1
  return {
    start: new Date(range.start.getTime() - diffMs),
    end: new Date(range.start.getTime() - 1),
  }
}

export function normalizeDateToMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

const BRAZIL_UTC_OFFSET_MS = 3 * 60 * 60 * 1000

/**
 * Trunca para o início do dia civil no horário de Brasília (UTC-3), e não no
 * dia UTC. getDateRange computa os limites de período no horário local do
 * navegador (Brasil); sem essa compensação, um evento perto da meia-noite
 * local cai no dia UTC seguinte/anterior e aparece no dia errado do gráfico.
 */
export function normalizeDateToBrazilDay(date: Date): Date {
  const shifted = new Date(date.getTime() - BRAZIL_UTC_OFFSET_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()))
}

export function formatDateLabel(date: Date | string): string {
  const d = new Date(date)
  const day = d.getUTCDate()
  const months = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']
  return `${day} ${months[d.getUTCMonth()]}`
}
