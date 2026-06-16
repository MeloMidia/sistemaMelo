export type PeriodKey = 'this-month' | 'last-month' | 'last-30' | 'last-90'

export type DateRange = { start: Date; end: Date }

export function getDateRange(period: PeriodKey): DateRange {
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
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function formatDateLabel(date: Date | string): string {
  const d = new Date(date)
  const day = d.getDate()
  const months = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']
  return `${day} ${months[d.getMonth()]}`
}
