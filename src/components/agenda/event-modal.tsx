'use client'

import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useCreateAgendaEvent, useUpdateAgendaEvent, useDeleteAgendaEvent, useEventCategories } from '@/hooks/agenda-api'
import type { AgendaEvent } from '@/types/agenda'

interface EventModalProps {
  mode: 'create' | 'edit'
  initialDate?: Date
  initialHour?: number
  event?: AgendaEvent
  onClose: () => void
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toTimeInputValue(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function EventModal({ mode, initialDate, initialHour, event, onClose }: EventModalProps) {
  const { data: categories } = useEventCategories()
  const createEvent = useCreateAgendaEvent()
  const updateEvent = useUpdateAgendaEvent()
  const deleteEvent = useDeleteAgendaEvent()

  const baseDate = event ? new Date(event.startsAt) : (initialDate ?? new Date())
  const baseStartHour = event ? undefined : (initialHour ?? 9)

  const [title, setTitle] = useState(event?.title ?? '')
  const [dateValue, setDateValue] = useState(toDateInputValue(baseDate))
  const [startTime, setStartTime] = useState(
    event ? toTimeInputValue(new Date(event.startsAt)) : `${String(baseStartHour).padStart(2, '0')}:00`
  )
  const [endTime, setEndTime] = useState(
    event ? toTimeInputValue(new Date(event.endsAt)) : `${String((baseStartHour ?? 9) + 1).padStart(2, '0')}:00`
  )
  const [categoryId, setCategoryId] = useState<string>(event?.categoryId ?? '')
  const [error, setError] = useState<string | null>(null)

  const isPending = createEvent.isPending || updateEvent.isPending || deleteEvent.isPending

  function buildIso(time: string): string {
    return new Date(`${dateValue}T${time}:00`).toISOString()
  }

  function handleSave() {
    setError(null)
    if (!title.trim()) {
      setError('Título é obrigatório')
      return
    }
    const startsAt = buildIso(startTime)
    const endsAt = buildIso(endTime)
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('O horário de fim deve ser depois do início')
      return
    }

    const payload = { title: title.trim(), startsAt, endsAt, categoryId: categoryId || null }

    if (mode === 'create') {
      createEvent.mutate(payload, {
        onSuccess: onClose,
        onError: (err) => setError(err instanceof Error ? err.message : 'Erro ao salvar'),
      })
    } else if (event) {
      updateEvent.mutate(
        { id: event.id, ...payload },
        {
          onSuccess: onClose,
          onError: (err) => setError(err instanceof Error ? err.message : 'Erro ao salvar'),
        }
      )
    }
  }

  function handleDelete() {
    if (!event) return
    deleteEvent.mutate(event.id, {
      onSuccess: onClose,
      onError: () => setError('Erro ao excluir evento'),
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#07080c]/70 backdrop-blur-md">
      <div className="bg-[#0c0e17] border border-white/[0.08] w-full max-w-sm rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.55)] relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none">
        <div className="flex justify-between items-center p-5 border-b border-white/[0.05]">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            {mode === 'create' ? 'Novo evento' : 'Editar evento'}
          </h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-7 h-7 rounded-full bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Reunião de Alinhamento"
              className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-[#07080c]/50 border border-white/[0.08] focus:border-blue-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-650 outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Data</label>
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-[#07080c]/50 border border-white/[0.08] focus:border-blue-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200 [color-scheme:dark]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Horário</label>
            <div className="flex gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1 bg-white/[0.03] hover:bg-white/[0.05] focus:bg-[#07080c]/50 border border-white/[0.08] focus:border-blue-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200 [color-scheme:dark]"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex-1 bg-white/[0.03] hover:bg-white/[0.05] focus:bg-[#07080c]/50 border border-white/[0.08] focus:border-blue-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200 [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Categoria</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-[#07080c]/50 border border-white/[0.08] focus:border-blue-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
            >
              <option value="" className="bg-[#0c0e17]">Sem categoria</option>
              {(categories || []).map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0c0e17]">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between p-5 border-t border-white/[0.05] bg-[#07080c]/20">
          {mode === 'edit' ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 cursor-pointer disabled:opacity-50 active:scale-95 transition-all duration-200"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer disabled:opacity-50 shadow-[0_4px_12px_rgba(59,130,246,0.2)] hover:shadow-[0_4px_20px_rgba(59,130,246,0.35)] active:scale-95 transition-all duration-200"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
