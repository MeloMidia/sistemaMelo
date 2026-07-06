import React from 'react'

export type KpiColorVariant = 'default' | 'blue' | 'amber' | 'red'

export interface KpiDelta {
  value: string
  direction: 'up' | 'down' | 'neutral'
}

interface KpiCardProps {
  title: string
  value: string
  rawValue?: number
  subtitle?: string
  icon?: React.ReactNode
  colorVariant?: KpiColorVariant
  delta?: KpiDelta
}

const topBorderClasses: Record<KpiColorVariant, string> = {
  default: 'border-t-white/20',
  blue: 'border-t-indigo-500',
  amber: 'border-t-amber-400',
  red: 'border-t-red-500',
}

const deltaColors = {
  up: 'text-emerald-400',
  down: 'text-red-400',
  neutral: 'text-slate-500',
}

const deltaArrows = { up: '▲', down: '▼', neutral: '—' }

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  colorVariant = 'default',
  delta,
}: KpiCardProps) {
  return (
    <div
      className={`bg-white/[0.03] border border-white/[0.07] border-t-2 ${topBorderClasses[colorVariant]} rounded-xl p-5 hover:bg-white/[0.05] transition-colors flex flex-col gap-2 min-h-[100px]`}
    >
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-xs font-medium">{title}</p>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold text-white tracking-tight leading-none">{value}</span>
        {delta && (
          <span className={`text-xs font-semibold ${deltaColors[delta.direction]}`}>
            {deltaArrows[delta.direction]} {delta.value}
          </span>
        )}
      </div>

      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  )
}
