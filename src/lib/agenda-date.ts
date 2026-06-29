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

export function validateEventRange(startsAt: Date, endsAt: Date): string | null {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return 'Data ou horário inválido'
  }
  if (endsAt <= startsAt) {
    return 'O horário de fim deve ser depois do início'
  }
  if (!isSameDay(startsAt, endsAt)) {
    return 'O evento deve começar e terminar no mesmo dia'
  }
  return null
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
  return `${String(hour).padStart(2, '0')}:00`
}
