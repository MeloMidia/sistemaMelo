import React, { useRef, useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'

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
  onSave?: (value: number) => Promise<void>
  editStep?: number
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
  rawValue,
  subtitle,
  icon,
  colorVariant = 'default',
  delta,
  onSave,
  editStep = 1,
}: KpiCardProps) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function openEdit() {
    setInputVal(String(rawValue ?? 0))
    setEditing(true)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 10)
  }

  function cancelEdit() {
    setEditing(false)
    setInputVal('')
  }

  async function confirmEdit() {
    const val = parseFloat(inputVal.replace(',', '.'))
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
    <div
      className={`bg-white/[0.03] border border-white/[0.07] border-t-2 ${topBorderClasses[colorVariant]} rounded-xl p-5 hover:bg-white/[0.05] transition-colors flex flex-col gap-2 min-h-[100px] group`}
    >
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-xs font-medium">{title}</p>
        <div className="flex items-center gap-1.5">
          {icon && <div className="text-slate-500">{icon}</div>}
          {onSave && !editing && (
            <button
              type="button"
              onClick={openEdit}
              className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.06] hover:border-white/20 text-slate-600 hover:text-slate-300 flex items-center justify-center cursor-pointer transition-all duration-150 opacity-0 group-hover:opacity-100"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            ref={inputRef}
            type="number"
            min="0"
            step={editStep}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="w-32 bg-white/[0.06] border border-blue-500/50 rounded-lg px-2 py-1 text-xl font-bold text-white outline-none focus:ring-1 focus:ring-blue-500/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
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
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-bold text-white tracking-tight leading-none">{value}</span>
          {delta && (
            <span className={`text-xs font-semibold ${deltaColors[delta.direction]}`}>
              {deltaArrows[delta.direction]} {delta.value}
            </span>
          )}
        </div>
      )}

      {subtitle && !editing && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  )
}
