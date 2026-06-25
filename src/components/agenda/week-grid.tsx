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
    <div className="flex-1 overflow-y-auto">
      {/* Cabeçalho dos dias */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] sticky top-0 bg-[#07080c] z-10 border-b border-white/[0.06]">
        <div />
        {days.map((day, i) => {
          const isToday = isSameDay(day, today)
          return (
            <div key={i} className="text-center py-2">
              <div className="text-[11px] text-slate-500 font-medium tracking-wide">
                {WEEKDAY_LABELS[day.getDay()]}
              </div>
              <div
                className={`mx-auto mt-1 w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold ${
                  isToday ? 'bg-blue-600 text-white' : 'text-white'
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Grade de horas */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)]">
        {/* Coluna de horários */}
        <div>
          {HOURS.map((hour) => (
            <div key={hour} style={{ height: HOUR_HEIGHT }} className="text-right pr-2 -mt-2">
              {hour > 0 && <span className="text-[10px] text-slate-500">{formatHourLabel(hour)}</span>}
            </div>
          ))}
        </div>

        {/* Colunas dos dias */}
        {days.map((day, dayIndex) => {
          const dayEvents = events.filter((e) => isSameDay(new Date(e.startsAt), day))
          const positioned = layoutDayEvents(dayEvents)

          return (
            <div key={dayIndex} className="relative border-l border-white/[0.04]">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  style={{ height: HOUR_HEIGHT }}
                  className="border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.02]"
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

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditEvent(event)
                    }}
                    style={{
                      top,
                      height,
                      width: `calc(${widthPct}% - 4px)`,
                      left: `calc(${leftPct}% + 2px)`,
                      backgroundColor: `${color}26`,
                      borderColor: color,
                    }}
                    className="absolute rounded-md border-l-[3px] px-1.5 py-0.5 text-left overflow-hidden cursor-pointer hover:brightness-125 transition-[filter]"
                  >
                    <span className="text-[11px] font-medium text-white truncate block leading-tight">
                      {event.title}
                    </span>
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
