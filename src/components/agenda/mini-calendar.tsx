'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { startOfWeek, addDays, isSameDay } from '@/lib/agenda-date'

interface MiniCalendarProps {
  weekStart: Date
  onSelectDate: (date: Date) => void
}

const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function buildMonthGrid(monthDate: Date): Date[] {
  const firstOfMonth = startOfMonth(monthDate)
  const gridStart = startOfWeek(firstOfMonth)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

export function MiniCalendar({ weekStart, onSelectDate }: MiniCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(weekStart))

  useEffect(() => {
    setViewMonth(startOfMonth(weekStart))
  }, [weekStart])

  const today = new Date()
  const weekEnd = addDays(weekStart, 6)
  const days = buildMonthGrid(viewMonth)

  const monthLabel = viewMonth
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase())

  function isInSelectedWeek(day: Date) {
    return day >= weekStart && day <= weekEnd
  }

  return (
    <div className="px-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300">{monthLabel}</span>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            aria-label="Mês anterior"
            className="p-1 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            aria-label="Próximo mês"
            className="p-1 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAY_SHORT.map((label, i) => (
          <span key={i} className="text-[10px] text-slate-500 font-medium">
            {label}
          </span>
        ))}
        {days.map((day, i) => {
          const inCurrentMonth = day.getMonth() === viewMonth.getMonth()
          const isToday = isSameDay(day, today)
          const inSelectedWeek = isInSelectedWeek(day)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(day)}
              className={`text-[11px] w-6 h-6 mx-auto rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                isToday
                  ? 'bg-blue-600 text-white font-semibold'
                  : inSelectedWeek
                    ? 'bg-white/[0.08] text-white'
                    : inCurrentMonth
                      ? 'text-slate-300 hover:bg-white/[0.06]'
                      : 'text-slate-600 hover:bg-white/[0.04]'
              }`}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
