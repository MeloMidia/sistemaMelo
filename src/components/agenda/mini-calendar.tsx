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
    <div className="px-1 select-none">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-1 text-slate-200">
          <select
            value={viewMonth.getMonth()}
            onChange={(e) => setViewMonth(new Date(viewMonth.getFullYear(), parseInt(e.target.value), 1))}
            className="bg-transparent text-xs font-bold text-slate-200 cursor-pointer outline-none hover:text-white transition-all duration-150 appearance-none hover:bg-white/[0.06] rounded px-1.5 py-0.5 [color-scheme:dark]"
          >
            {Array.from({ length: 12 }, (_, i) => {
              const date = new Date(2026, i, 1)
              const name = date.toLocaleDateString('pt-BR', { month: 'long' })
              return (
                <option key={i} value={i}>
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </option>
              )
            })}
          </select>
          <span className="text-xs font-semibold text-slate-600">/</span>
          <select
            value={viewMonth.getFullYear()}
            onChange={(e) => setViewMonth(new Date(parseInt(e.target.value), viewMonth.getMonth(), 1))}
            className="bg-transparent text-xs font-bold text-slate-200 cursor-pointer outline-none hover:text-white transition-all duration-150 appearance-none hover:bg-white/[0.06] rounded px-1.5 py-0.5 [color-scheme:dark]"
          >
            {Array.from({ length: 11 }, (_, i) => {
              const year = new Date().getFullYear() - 5 + i
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              )
            })}
          </select>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            aria-label="Mês anterior"
            className="p-1.5 rounded-lg border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 text-slate-400 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            aria-label="Próximo mês"
            className="p-1.5 rounded-lg border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 text-slate-400 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {WEEKDAY_SHORT.map((label, i) => (
          <span key={i} className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">
            {label}
          </span>
        ))}
        {days.map((day, i) => {
          const inCurrentMonth = day.getMonth() === viewMonth.getMonth()
          const isToday = isSameDay(day, today)
          const inSelectedWeek = isInSelectedWeek(day)
          
          let btnClass = ""
          if (isToday) {
            btnClass = "bg-blue-600 text-white font-bold shadow-[0_0_12px_rgba(59,130,246,0.5)] scale-105"
          } else if (inSelectedWeek) {
            btnClass = "bg-blue-500/10 border border-blue-500/25 text-blue-400 font-semibold scale-105 hover:bg-blue-500/20"
          } else if (inCurrentMonth) {
            btnClass = "text-slate-300 hover:bg-white/[0.06] hover:text-white"
          } else {
            btnClass = "text-slate-600 hover:bg-white/[0.03] hover:text-slate-400"
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(day)}
              className={`text-[11px] w-6.5 h-6.5 mx-auto rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ${btnClass}`}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
