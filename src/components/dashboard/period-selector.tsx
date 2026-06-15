'use client'

import React from 'react'
import { ChevronDown } from 'lucide-react'
import type { PeriodKey } from '@/lib/date-range'

const PERIOD_LABELS: Record<PeriodKey, string> = {
  'this-month': 'Este mês',
  'last-month': 'Mês anterior',
  'last-30': 'Últimos 30 dias',
  'last-90': 'Últimos 90 dias',
}

interface PeriodSelectorProps {
  period: PeriodKey
  showComparison: boolean
  onPeriodChange: (p: PeriodKey) => void
  onComparisonChange: (show: boolean) => void
}

export function PeriodSelector({
  period,
  showComparison,
  onPeriodChange,
  onComparisonChange,
}: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative">
        <select
          value={period}
          onChange={e => onPeriodChange(e.target.value as PeriodKey)}
          className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2 pr-9 text-sm text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map(key => (
            <option key={key} value={key} className="bg-[#0f111a]">
              {PERIOD_LABELS[key]}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      <div className="relative">
        <select
          value={showComparison ? 'previous' : 'none'}
          onChange={e => onComparisonChange(e.target.value === 'previous')}
          className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2 pr-9 text-sm text-slate-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="previous" className="bg-[#0f111a]">
            Comparar: período anterior
          </option>
          <option value="none" className="bg-[#0f111a]">
            Sem comparação
          </option>
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  )
}
