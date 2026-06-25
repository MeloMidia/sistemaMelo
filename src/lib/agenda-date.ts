// Domingo como início da semana (padrão Google Agenda em pt-BR)
export function startOfWeek(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  result.setDate(result.getDate() - result.getDay())
  return result
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function endOfWeek(date: Date): Date {
  const end = addDays(startOfWeek(date), 6)
  end.setHours(23, 59, 59, 999)
  return end
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

export function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6)
  const startMonth = weekStart.toLocaleDateString('pt-BR', { month: 'long' })
  const endMonth = weekEnd.toLocaleDateString('pt-BR', { month: 'long' })
  if (startMonth === endMonth) {
    return `${weekStart.getDate()} – ${weekEnd.getDate()} de ${capitalize(startMonth)}`
  }
  return `${weekStart.getDate()} de ${capitalize(startMonth)} – ${weekEnd.getDate()} de ${capitalize(endMonth)}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const WEEKDAY_LABELS = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.']
export const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}
