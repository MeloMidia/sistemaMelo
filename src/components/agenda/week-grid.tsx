'use client'

import { addDays, isSameDay, WEEKDAY_LABELS, HOURS, formatHourLabel } from '@/lib/agenda-date'
import type { AgendaEvent } from '@/types/agenda'

interface WeekGridProps {
  weekStart: Date
  events: AgendaEvent[]
  onCreateAt: (date: Date, hour: number) => void
  onEditEvent: (event: AgendaEvent) => void
}

const HOUR_HEIGHT = 48 // px
const MIN_EVENT_HEIGHT = 22 // px

interface PositionedEvent {
  event: AgendaEvent
  column: number
  columnCount: number
}

// Atribui cada evento a uma "coluna" (pra não sobrepor visualmente) e calcula
// quantos eventos ele realmente sobrepõe no tempo, pra dividir a largura.
// Simplificação aceita: columnCount é por evento (overlaps individuais), não
// um empacotamento ótimo de todo o grupo — suficiente pro volume baixo de
// eventos de uma agenda interna pequena.
function layoutDayEvents(dayEvents: AgendaEvent[]): PositionedEvent[] {
  const sorted = [...dayEvents].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )
  const columns: AgendaEvent[][] = []
  const placement = new Map<string, number>()

  for (const event of sorted) {
    const start = new Date(event.startsAt).getTime()
    let placed = false
    for (let i = 0; i < columns.length; i++) {
      const lastInColumn = columns[i][columns[i].length - 1]
      const lastEnd = new Date(lastInColumn.endsAt).getTime()
      if (start >= lastEnd) {
        columns[i].push(event)
        placement.set(event.id, i)
        placed = true
        break
      }
    }
    if (!placed) {
      columns.push([event])
      placement.set(event.id, columns.length - 1)
    }
  }

  return sorted.map((event) => {
    const start = new Date(event.startsAt).getTime()
    const end = new Date(event.endsAt).getTime()
    let overlapCount = 1
    for (const other of sorted) {
      if (other.id === event.id) continue
      const oStart = new Date(other.startsAt).getTime()
      const oEnd = new Date(other.endsAt).getTime()
      if (oStart < end && oEnd > start) overlapCount += 1
    }
    return { event, column: placement.get(event.id) ?? 0, columnCount: overlapCount }
  })
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function WeekGrid({ weekStart, events, onCreateAt, onEditEvent }: WeekGridProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = new Date()

  return (
    <div className="flex-1 overflow-y-auto select-none bg-[#07080c]">
      {/* Cabeçalho dos dias */}
      <div className="grid grid-cols-[65px_repeat(7,1fr)] sticky top-0 bg-[#07080c]/90 backdrop-blur-md z-10 border-b border-white/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
        <div className="border-r border-white/[0.04]" />
        {days.map((day, i) => {
          const isToday = isSameDay(day, today)
          return (
            <div key={i} className="text-center py-3 border-r border-white/[0.03] last:border-r-0 flex flex-col justify-between min-h-[76px]">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {WEEKDAY_LABELS[day.getDay()]}
              </div>
              <div className="flex-1 flex flex-col items-center justify-center mt-1">
                <div
                  className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-200 ${
                    isToday 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)] border border-blue-400/20' 
                      : 'text-slate-300 hover:bg-white/[0.06] hover:text-white border border-transparent'
                  }`}
                >
                  {day.getDate()}
                </div>
                {isToday && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shadow-[0_0_8px_rgba(59,130,246,1)] animate-pulse" />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Grade de horas */}
      <div className="grid grid-cols-[65px_repeat(7,1fr)]">
        {/* Coluna de horários */}
        <div className="border-r border-white/[0.04] bg-[#07080c]/30">
          {HOURS.map((hour) => (
            <div key={hour} style={{ height: HOUR_HEIGHT }} className="relative text-right pr-3 flex items-start justify-end">
              {hour > 0 && (
                <span className="absolute top-0 right-3 -translate-y-1/2 text-[10px] font-bold text-slate-500/80 tracking-wider">
                  {formatHourLabel(hour)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Colunas dos dias */}
        {days.map((day, dayIndex) => {
          const dayEvents = events.filter((e) => isSameDay(new Date(e.startsAt), day))
          const positioned = layoutDayEvents(dayEvents)
          const isDayToday = isSameDay(day, today)

          return (
            <div 
              key={dayIndex} 
              className={`relative border-r border-white/[0.03] last:border-r-0 ${
                isDayToday ? 'bg-gradient-to-b from-blue-500/[0.015] to-transparent' : ''
              }`}
            >
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  style={{ height: HOUR_HEIGHT }}
                  className="border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.015] transition-colors duration-150"
                  onClick={() => onCreateAt(day, hour)}
                />
              ))}

              {positioned.map(({ event, column, columnCount }) => {
                const start = new Date(event.startsAt)
                const end = new Date(event.endsAt)
                const top = (minutesFromMidnight(start) / 60) * HOUR_HEIGHT
                const height = Math.max(
                  ((minutesFromMidnight(end) - minutesFromMidnight(start)) / 60) * HOUR_HEIGHT,
                  MIN_EVENT_HEIGHT
                )
                const widthPct = 100 / columnCount
                const leftPct = column * widthPct
                const color = event.category?.color ?? '#64748b'
                
                const timeStr = `${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditEvent(event)
                    }}
                    title={event.description || undefined}
                    style={{
                      top: top + 2,
                      height: height - 4,
                      width: `calc(${widthPct}% - 4px)`,
                      left: `calc(${leftPct}% + 2px)`,
                      backgroundColor: color,
                    }}
                    className="absolute rounded-lg px-2.5 py-1.5 text-left overflow-hidden cursor-pointer shadow-md hover:opacity-90 hover:-translate-y-[0.5px] hover:shadow-lg active:scale-[0.98] transition-all duration-150 flex flex-col justify-start"
                  >
                    <span className="flex items-center gap-1 min-w-0">
                      <span className="text-[11px] font-bold text-white truncate leading-tight tracking-tight">
                        {event.title}
                      </span>
                      {event.lead?.temperature && (
                        <span className="text-[10px] shrink-0 select-none">{event.lead.temperature}</span>
                      )}
                    </span>
                    {height >= 38 && (
                      <span className="text-[9px] text-white/75 font-semibold truncate block mt-0.5 select-none leading-none">
                        {timeStr}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
