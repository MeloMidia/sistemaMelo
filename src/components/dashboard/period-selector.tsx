'use client'

import React from 'react'
import { ChevronDown } from 'lucide-react'
import type { DateRange, PeriodKey } from '@/lib/date-range'

const PERIOD_LABELS: Record<PeriodKey, string> = {
  'this-month': 'Este mês',
  'last-month': 'Mês anterior',
  'last-30': 'Últimos 30 dias',
  'last-90': 'Últimos 90 dias',
  custom: 'Personalizado',
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateInputValue(value: string): Date | null {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

interface PeriodSelectorProps {
  period: PeriodKey
  showComparison: boolean
  customRange: DateRange
  onPeriodChange: (p: PeriodKey) => void
  onComparisonChange: (show: boolean) => void
  onCustomRangeChange: (range: DateRange) => void
}

export function PeriodSelector({
  period,
  showComparison,
  customRange,
  onPeriodChange,
  onComparisonChange,
  onCustomRangeChange,
}: PeriodSelectorProps) {
  return (
    <div className="flex items-end gap-4 flex-wrap">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-slate-500 font-medium">Período principal</span>
        <div className="relative">
          <select
            value={period}
            onChange={e => onPeriodChange(e.target.value as PeriodKey)}
            className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2 pr-9 text-sm text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map(key => (
              <option key={key} value={key}>
                {PERIOD_LABELS[key]}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 font-medium">De</span>
            <input
              type="date"
              value={toDateInputValue(customRange.start)}
              max={toDateInputValue(customRange.end)}
              onChange={e => {
                const start = parseDateInputValue(e.target.value)
                if (start) onCustomRangeChange({ start, end: customRange.end })
              }}
              className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 font-medium">Até</span>
            <input
              type="date"
              value={toDateInputValue(customRange.end)}
              min={toDateInputValue(customRange.start)}
              onChange={e => {
                const end = parseDateInputValue(e.target.value)
                if (end) onCustomRangeChange({ start: customRange.start, end })
              }}
              className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs text-slate-500 font-medium">Comparar com</span>
        <div className="relative">
          <select
            value={showComparison ? 'previous' : 'none'}
            onChange={e => onComparisonChange(e.target.value === 'previous')}
            className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2 pr-9 text-sm text-slate-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="previous">Período anterior</option>
            <option value="none">Sem comparação</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>
    </div>
  )
}
