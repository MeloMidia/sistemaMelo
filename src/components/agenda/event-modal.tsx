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
    deleteEvent.mutate(event.id, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#07080c]/80 backdrop-blur-sm">
      <div className="bg-[#0f111a] border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b border-white/5">
          <h2 className="text-base font-semibold text-white">
            {mode === 'create' ? 'Novo evento' : 'Editar evento'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do evento"
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50"
            autoFocus
          />

          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 [color-scheme:dark]"
          />

          <div className="flex gap-2">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 [color-scheme:dark]"
            />
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 [color-scheme:dark]"
            />
          </div>

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
          >
            <option value="" className="bg-[#0f111a]">Sem categoria</option>
            {(categories || []).map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0f111a]">
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between p-5 border-t border-white/5">
          {mode === 'edit' ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 cursor-pointer disabled:opacity-50"
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
              className="px-4 py-2 text-sm text-slate-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg cursor-pointer disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
