import React from 'react'

interface TriGoalBarProps {
  title: string
  currentValue: number
  goal1: number
  goal2: number
  goal3: number
  formatValue?: (val: number) => string
}

export function TriGoalBar({ title, currentValue, goal1, goal2, goal3, formatValue }: TriGoalBarProps) {
  const fmt = formatValue ?? ((v: number) => v.toString())

  const percentText = goal1 > 0 ? (currentValue / goal1) * 100 : 0

  let activeGoal = goal1
  if (currentValue >= goal2) activeGoal = goal3
  else if (currentValue >= goal1) activeGoal = goal2

  const total = goal3
  const seg1Width = (goal1 / total) * 100
  const seg2Width = ((goal2 - goal1) / total) * 100

  const fill1 = Math.min((currentValue / goal1) * 100, 100)
  const fill2 = Math.min(Math.max((currentValue - goal1) / (goal2 - goal1) * 100, 0), 100)
  const fill3 = Math.min(Math.max((currentValue - goal2) / (goal3 - goal2) * 100, 0), 100)

  const labelSeg1 = seg1Width
  const labelSeg2 = seg1Width + seg2Width

  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-500 opacity-[0.05] blur-3xl rounded-full group-hover:opacity-[0.08] transition-opacity" />

      {/* Header */}
      <div className="flex justify-between items-end mb-4 relative z-10">
        <div className="flex-1 min-w-0">
          <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold text-white tracking-tight">{fmt(currentValue)}</span>
            <span className="text-sm font-medium text-slate-500">/ Meta: {fmt(activeGoal)}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-yellow-500">
            {percentText.toFixed(0)}%
          </span>
          <p className="text-[10px] text-slate-600 mt-0.5">base {fmt(goal1)}</p>
        </div>
      </div>

      {/* Bar */}
      <div className="relative z-10 w-full pb-6">
        <div className="h-3 w-full rounded-full shadow-inner flex overflow-hidden border border-white/5">
          <div className="h-full bg-slate-900 relative flex-shrink-0" style={{ width: `${seg1Width}%` }}>
            <div className="h-full bg-gradient-to-r from-emerald-700 to-emerald-400 transition-all duration-1000 ease-out absolute left-0 top-0" style={{ width: `${fill1}%` }} />
          </div>
          <div className="w-px h-full bg-white/25 flex-shrink-0" />
          <div className="h-full bg-slate-900 relative flex-shrink-0" style={{ width: `${seg2Width}%` }}>
            <div className="h-full bg-gradient-to-r from-slate-500 to-slate-300 transition-all duration-1000 ease-out absolute left-0 top-0" style={{ width: `${fill2}%` }} />
          </div>
          <div className="w-px h-full bg-white/25 flex-shrink-0" />
          <div className="h-full bg-slate-900 relative flex-1">
            <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-300 transition-all duration-1000 ease-out absolute left-0 top-0" style={{ width: `${fill3}%` }} />
          </div>
        </div>

        <div className="relative mt-1.5 text-[10px] w-full h-4">
          <span className="absolute left-0 text-emerald-500/70 font-medium">0</span>
          <span className="absolute text-emerald-500/70 font-medium" style={{ left: `calc(${labelSeg1}% - 12px)` }}>{fmt(goal1)}</span>
          <span className="absolute text-slate-400/70 font-medium" style={{ left: `calc(${labelSeg2}% - 12px)` }}>{fmt(goal2)}</span>
          <span className="absolute right-0 text-yellow-600/70 font-medium">{fmt(goal3)} ✦</span>
        </div>
      </div>
    </div>
  )
}
