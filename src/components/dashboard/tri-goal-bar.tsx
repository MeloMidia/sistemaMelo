import React, { useRef, useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'

interface TriGoalBarProps {
  title: string
  currentValue: number
  goal1: number
  goal2: number
  goal3: number
  formatValue?: (val: number) => string
  onSave?: (value: number) => Promise<void>
  editLabel?: string
}

export function TriGoalBar({ title, currentValue, goal1, goal2, goal3, formatValue, onSave, editLabel }: TriGoalBarProps) {
  const fmt = formatValue ?? ((v: number) => v.toString())

  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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

  function openEdit() {
    setInputVal(String(currentValue))
    setEditing(true)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 10)
  }

  function cancelEdit() {
    setEditing(false)
    setInputVal('')
  }

  async function confirmEdit() {
    const val = parseInt(inputVal, 10)
    if (isNaN(val) || val < 0) { cancelEdit(); return }
    setSaving(true)
    try {
      await onSave?.(val)
    } finally {
      setSaving(false)
      setEditing(false)
      setInputVal('')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') confirmEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-500 opacity-[0.05] blur-3xl rounded-full group-hover:opacity-[0.08] transition-opacity" />

      {/* Header */}
      <div className="flex justify-between items-end mb-4 relative z-10">
        <div className="flex-1 min-w-0">
          <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
          <div className="flex items-baseline gap-2">
            {editing ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  type="number"
                  min="0"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={saving}
                  className="w-24 bg-white/[0.06] border border-blue-500/50 rounded-lg px-2 py-1 text-xl font-semibold text-white outline-none focus:ring-1 focus:ring-blue-500/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={confirmEdit}
                  disabled={saving}
                  className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer disabled:opacity-50 transition-colors shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-400 flex items-center justify-center cursor-pointer disabled:opacity-50 transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-white tracking-tight">{fmt(currentValue)}</span>
                <span className="text-sm font-medium text-slate-500">/ Meta: {fmt(activeGoal)}</span>
                {onSave && (
                  <button
                    type="button"
                    onClick={openEdit}
                    title={editLabel ?? 'Editar'}
                    className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.06] hover:border-white/20 text-slate-600 hover:text-slate-300 flex items-center justify-center cursor-pointer transition-all duration-150 opacity-0 group-hover:opacity-100"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
          {editing && editLabel && (
            <p className="text-[10px] text-slate-500 mt-1">{editLabel}</p>
          )}
        </div>
        {!editing && (
          <div className="text-right shrink-0">
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-yellow-500">
              {percentText.toFixed(0)}%
            </span>
            <p className="text-[10px] text-slate-600 mt-0.5">base {fmt(goal1)}</p>
          </div>
        )}
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
