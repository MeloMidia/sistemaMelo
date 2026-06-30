'use client'

import { useState } from 'react'
import { X, Trash2, Repeat } from 'lucide-react'
import {
  useCreateAgendaEvent,
  useUpdateAgendaEvent,
  useDeleteAgendaEvent,
  useCreateAgendaEventSeries,
  useUpdateAgendaEventSeries,
  useDeleteAgendaEventSeries,
  useEventCategories,
} from '@/hooks/agenda-api'
import { useLeadsLite } from '@/hooks/crm-api'
import { getLeadDisplayName } from '@/lib/phone'
import { WEEKDAY_LABELS } from '@/lib/agenda-date'
import type { AgendaEvent, AgendaEventStatus } from '@/types/agenda'

const STATUS_OPTIONS: { value: AgendaEventStatus; label: string }[] = [
  { value: 'AGENDADA', label: 'Agendada' },
  { value: 'REALIZADA', label: 'Realizada' },
  { value: 'NAO_REALIZADA', label: 'Não realizada' },
  { value: 'CANCELADA', label: 'Cancelada' },
]

interface EventModalProps {
  mode: 'create' | 'edit'
  initialDate?: Date
  initialHour?: number
  initialTitle?: string
  initialDescription?: string
  initialCategoryId?: string
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

function parseDateInputValue(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function EventModal({
  mode,
  initialDate,
  initialHour,
  initialTitle,
  initialDescription,
  initialCategoryId,
  event,
  onClose
}: EventModalProps) {
  const { data: categories } = useEventCategories()
  const { data: leads } = useLeadsLite()
  const createEvent = useCreateAgendaEvent()
  const updateEvent = useUpdateAgendaEvent()
  const deleteEvent = useDeleteAgendaEvent()
  const createSeries = useCreateAgendaEventSeries()
  const updateSeries = useUpdateAgendaEventSeries()
  const deleteSeries = useDeleteAgendaEventSeries()

  const baseDate = event ? new Date(event.startsAt) : (initialDate ?? new Date())
  const baseStartHour = event ? undefined : (initialHour ?? 9)

  const [title, setTitle] = useState(event?.title ?? initialTitle ?? '')
  const [description, setDescription] = useState(event?.description ?? initialDescription ?? '')
  const [dateValue, setDateValue] = useState(toDateInputValue(baseDate))
  const [startTime, setStartTime] = useState(
    event ? toTimeInputValue(new Date(event.startsAt)) : `${String(baseStartHour).padStart(2, '0')}:00`
  )
  const [endTime, setEndTime] = useState(
    event ? toTimeInputValue(new Date(event.endsAt)) : `${String((baseStartHour ?? 9) + 1).padStart(2, '0')}:00`
  )
  const [categoryId, setCategoryId] = useState<string>(event?.categoryId ?? initialCategoryId ?? '')
  const [leadId, setLeadId] = useState<string>(event?.leadId ?? '')
  const [status, setStatus] = useState<AgendaEventStatus>(event?.status ?? 'AGENDADA')
  const [error, setError] = useState<string | null>(null)

  const [repeatOn, setRepeatOn] = useState(false)
  const [repeatWeekdays, setRepeatWeekdays] = useState<Set<number>>(new Set())
  const [repeatUntil, setRepeatUntil] = useState('')

  function handleToggleRepeat() {
    setRepeatOn((wasOn) => {
      // Ao ligar, pré-seleciona o dia da semana da data ATUAL do formulário
      // (não a data de quando o modal abriu — o usuário pode ter trocado).
      if (!wasOn && repeatWeekdays.size === 0) {
        setRepeatWeekdays(new Set([parseDateInputValue(dateValue).getDay()]))
      }
      return !wasOn
    })
  }

  // Quando o evento editado pertence a uma série, pergunta se a mudança
  // (salvar ou excluir) vale só pra esta ocorrência ou pra série inteira.
  const [seriesChoice, setSeriesChoice] = useState<null | 'save' | 'delete'>(null)

  function toggleRepeatWeekday(day: number) {
    setRepeatWeekdays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  function handleLeadIdChange(value: string) {
    setLeadId(value)
    // Sem lead vinculado o seletor de status fica oculto; reseta para o
    // padrão para não salvar um status "fantasma" que o usuário não vê mais.
    if (!value) setStatus('AGENDADA')
  }

  const isPending =
    createEvent.isPending || updateEvent.isPending || deleteEvent.isPending ||
    createSeries.isPending || updateSeries.isPending || deleteSeries.isPending

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

    const payload = { title: title.trim(), description: description.trim() || null, startsAt, endsAt, categoryId: categoryId || null, leadId: leadId || null }

    if (mode === 'create' && repeatOn) {
      if (repeatWeekdays.size === 0) {
        setError('Selecione ao menos um dia da semana pra repetição')
        return
      }
      if (!repeatUntil) {
        setError('Informe até quando a repetição deve continuar')
        return
      }
      if (parseDateInputValue(repeatUntil) < parseDateInputValue(dateValue)) {
        setError('A data final da repetição deve ser depois da data inicial')
        return
      }
      createSeries.mutate(
        {
          title: title.trim(),
          description: description.trim() || null,
          categoryId: categoryId || null,
          leadId: leadId || null,
          startTime,
          endTime,
          seriesStartDate: parseDateInputValue(dateValue).toISOString(),
          weekdays: Array.from(repeatWeekdays),
          untilDate: parseDateInputValue(repeatUntil).toISOString(),
        },
        {
          onSuccess: onClose,
          onError: (err) => setError(err instanceof Error ? err.message : 'Erro ao salvar'),
        }
      )
    } else if (mode === 'create') {
      createEvent.mutate(payload, {
        onSuccess: onClose,
        onError: (err) => setError(err instanceof Error ? err.message : 'Erro ao salvar'),
      })
    } else if (event?.seriesId) {
      setSeriesChoice('save')
    } else if (event) {
      updateEvent.mutate(
        { id: event.id, ...payload, status },
        {
          onSuccess: onClose,
          onError: (err) => setError(err instanceof Error ? err.message : 'Erro ao salvar'),
        }
      )
    }
  }

  function handleDelete() {
    if (!event) return
    if (event.seriesId) {
      setSeriesChoice('delete')
      return
    }
    deleteEvent.mutate(event.id, {
      onSuccess: onClose,
      onError: () => setError('Erro ao excluir evento'),
    })
  }

  function confirmSeriesChoice(applyToWholeSeries: boolean) {
    if (!event) return
    setError(null)

    if (seriesChoice === 'save') {
      const startsAt = buildIso(startTime)
      const endsAt = buildIso(endTime)
      const payload = { title: title.trim(), description: description.trim() || null, categoryId: categoryId || null, leadId: leadId || null }

      if (applyToWholeSeries) {
        updateSeries.mutate(
          { seriesId: event.seriesId!, fromDate: event.startsAt, ...payload, status, startTime, endTime },
          {
            onSuccess: onClose,
            onError: (err) => setError(err instanceof Error ? err.message : 'Erro ao salvar'),
          }
        )
      } else {
        updateEvent.mutate(
          { id: event.id, ...payload, startsAt, endsAt, status },
          {
            onSuccess: onClose,
            onError: (err) => setError(err instanceof Error ? err.message : 'Erro ao salvar'),
          }
        )
      }
    } else if (seriesChoice === 'delete') {
      if (applyToWholeSeries) {
        deleteSeries.mutate(
          { seriesId: event.seriesId!, fromDate: event.startsAt },
          { onSuccess: onClose, onError: () => setError('Erro ao excluir série') }
        )
      } else {
        deleteEvent.mutate(event.id, {
          onSuccess: onClose,
          onError: () => setError('Erro ao excluir evento'),
        })
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-[#0c0e17] border border-white/[0.15] w-full max-w-sm max-h-[90vh] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.55)] relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-white/[0.05] shrink-0">
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

        <div className="p-5 space-y-3.5 overflow-y-auto">
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

          {mode === 'create' && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleToggleRepeat}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition-all duration-200 cursor-pointer ${
                  repeatOn
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                    : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Repeat className="w-3.5 h-3.5" />
                  Repetir semanalmente
                </span>
                <span className={`w-4 h-4 rounded border ${repeatOn ? 'bg-blue-500 border-blue-500' : 'border-white/20'}`} />
              </button>

              {repeatOn && (
                <div className="space-y-2 pl-1">
                  <div className="flex gap-1">
                    {WEEKDAY_LABELS.map((label, day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleRepeatWeekday(day)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all duration-200 cursor-pointer ${
                          repeatWeekdays.has(day)
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                            : 'bg-white/[0.03] border-white/[0.08] text-slate-500 hover:text-white'
                        }`}
                      >
                        {label.replace('.', '')}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Repetir até</label>
                    <input
                      type="date"
                      value={repeatUntil}
                      onChange={(e) => setRepeatUntil(e.target.value)}
                      className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-[#07080c]/50 border border-white/[0.08] focus:border-blue-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200 [color-scheme:dark]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

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

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Lead vinculado</label>
            <select
              value={leadId}
              onChange={(e) => handleLeadIdChange(e.target.value)}
              className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-[#07080c]/50 border border-white/[0.08] focus:border-blue-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
            >
              <option value="" className="bg-[#0c0e17]">Sem lead</option>
              {(leads ?? []).map((lead) => (
                <option key={lead.id} value={lead.id} className="bg-[#0c0e17]">
                  {lead.temperature ? `${lead.temperature} ` : ''}{getLeadDisplayName(lead)}
                </option>
              ))}
            </select>
          </div>

          {mode === 'edit' && leadId && (
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Status da reunião</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AgendaEventStatus)}
                className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-[#07080c]/50 border border-white/[0.08] focus:border-blue-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#0c0e17]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Descrição / Anotações</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione anotações sobre a reunião/compromisso..."
              className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-[#07080c]/50 border border-white/[0.08] focus:border-blue-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-650 outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200 resize-none h-20"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-5 border-t border-white/[0.05] bg-[#07080c]/20 shrink-0">
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

        {seriesChoice && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
            <div className="w-full space-y-3 text-center">
              <p className="text-sm text-slate-200 font-medium">
                {seriesChoice === 'save' ? 'Salvar alterações em:' : 'Excluir:'}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => confirmSeriesChoice(false)}
                  disabled={isPending}
                  className="w-full px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer disabled:opacity-50 transition-all duration-200"
                >
                  Somente este evento
                </button>
                <button
                  type="button"
                  onClick={() => confirmSeriesChoice(true)}
                  disabled={isPending}
                  className={`w-full px-4 py-2.5 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer disabled:opacity-50 transition-all duration-200 ${
                    seriesChoice === 'delete' ? 'bg-red-600/80 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  Este e os próximos da série
                </button>
                <button
                  type="button"
                  onClick={() => setSeriesChoice(null)}
                  disabled={isPending}
                  className="w-full px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 transition-all duration-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
