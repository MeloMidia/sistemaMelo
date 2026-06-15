import React from 'react'

export type KpiColorVariant = 'default' | 'blue' | 'amber' | 'red'

export interface KpiDelta {
  value: string
  direction: 'up' | 'down' | 'neutral'
}

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: React.ReactNode
  colorVariant?: KpiColorVariant
  delta?: KpiDelta
}

const borderClasses: Record<KpiColorVariant, string> = {
  default: 'border-l-white/10',
  blue: 'border-l-indigo-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
}

const deltaTextClasses = {
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
      className={`bg-white/[0.02] border border-white/[0.05] border-l-4 ${borderClasses[colorVariant]} rounded-xl p-5 hover:bg-white/[0.04] transition-colors flex flex-col justify-between h-full relative overflow-hidden group min-h-[110px]`}
    >
      <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-white/[0.02] blur-xl rounded-full group-hover:bg-white/[0.05] transition-colors" />

      <div className="flex items-start justify-between mb-3 relative z-10">
        <h3 className="text-slate-400 text-xs font-medium pr-4">{title}</h3>
        {icon && (
          <div className="text-slate-500 shrink-0 bg-white/[0.03] p-1.5 rounded-lg border border-white/[0.05]">
            {icon}
          </div>
        )}
      </div>

      <div className="relative z-10 mt-auto">
        <div className="text-2xl font-semibold text-white tracking-tight">{value}</div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {subtitle && <div className="text-xs text-slate-500 font-medium">{subtitle}</div>}
          {delta && (
            <span className={`text-xs font-semibold ${deltaTextClasses[delta.direction]}`}>
              {deltaArrows[delta.direction]} {delta.value}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
