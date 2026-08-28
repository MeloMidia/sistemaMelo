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
  default: 'border-l-[#2854DF]',
  blue: 'border-l-[#5E82F2]',
  amber: 'border-l-[#C98720]',
  red: 'border-l-[#BC4C4B]',
}

const deltaColors = {
  up: 'text-[#16805D]',
  down: 'text-[#BC4C4B]',
  neutral: 'text-[#6C716E]',
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
      className={`mf-stat border border-l-[3px] ${topBorderClasses[colorVariant]} rounded-2xl p-5 transition-colors flex flex-col gap-2 min-h-[112px]`}
    >
      <div className="flex items-center justify-between">
        <p className="mf-label">{title}</p>
        {icon && <div className="text-[#6C716E]">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold text-[#151817] tracking-tight leading-none tabular-nums">{value}</span>
        {delta && (
          <span className={`text-xs font-semibold ${deltaColors[delta.direction]}`}>
            {deltaArrows[delta.direction]} {delta.value}
          </span>
        )}
      </div>

      {subtitle && <p className="text-xs text-[#6C716E]">{subtitle}</p>}
    </div>
  )
}
