'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Trash2, Repeat, Search, Trophy } from 'lucide-react'
import confetti from 'canvas-confetti'
import {
  useCreateAgendaEvent,
  useUpdateAgendaEvent,
  useDeleteAgendaEvent,
  useCreateAgendaEventSeries,
  useUpdateAgendaEventSeries,
  useDeleteAgendaEventSeries,
  useEventCategories,
} from '@/hooks/agenda-api'
import { useLeadsLite, useStages, useUpdateLead } from '@/hooks/crm-api'
import { getLeadDisplayName, formatPhoneNumber } from '@/lib/phone'
import { WEEKDAY_LABELS } from '@/lib/agenda-date'
import type { AgendaEvent, AgendaEventStatus } from '@/types/agenda'

interface EventModalProps {
  mode: 'create' | 'edit'
  initialDate?: Date
  initialHour?: number
  initialTitle?: string
  initialDescription?: string
  initialCategoryId?: string
  initialLeadId?: string
  event?: AgendaEvent
  onClose: () => void
  onOpenLeadInCrm?: (leadId: string) => void
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
  initialLeadId,
  event,
  onClose,
  onOpenLeadInCrm,
}: EventModalProps) {
  const { data: categories } = useEventCategories()
  const { data: leads } = useLeadsLite()
  const { data: stages } = useStages()
  const updateLead = useUpdateLead()
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
  const [leadId, setLeadId] = useState<string>(event?.leadId ?? initialLeadId ?? '')
  const [status, setStatus] = useState<AgendaEventStatus>(event?.status ?? 'AGENDADA')
  const [error, setError] = useState<string | null>(null)

  const [repeatOn, setRepeatOn] = useState(false)
  const [repeatWeekdays, setRepeatWeekdays] = useState<Set<number>>(new Set())
  const [repeatUntil, setRepeatUntil] = useState('')

  const [leadSearch, setLeadSearch] = useState('')
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false)
  const leadInputRef = useRef<HTMLInputElement>(null)
  const [autoFilledNote, setAutoFilledNote] = useState('')

  // Sale conversion states
  const wasAlreadyRealizada = mode === 'edit' && event?.status === 'REALIZADA'
  const [convertedToSale, setConvertedToSale] = useState<boolean | null>(null)
  const [saleValue, setSaleValue] = useState('')
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationValue, setCelebrationValue] = useState(0)
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null)

  const showSaleQuestion = status === 'REALIZADA' && !wasAlreadyRealizada

  const selectedLead = (leads ?? []).find((l) => l.id === leadId)
  const filteredLeads = leadSearch.trim()
    ? (leads ?? []).filter((l) => {
        const q = leadSearch.trim().toLowerCase()
        return (
          getLeadDisplayName(l).toLowerCase().includes(q) ||
          l.phone.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
        )
      })
    : (leads ?? [])

  function handleToggleRepeat() {
    setRepeatOn((wasOn) => {
      if (!wasOn && repeatWeekdays.size === 0) {
        setRepeatWeekdays(new Set([parseDateInputValue(dateValue).getDay()]))
      }
      return !wasOn
    })
  }

  const [seriesChoice, setSeriesChoice] = useState<null | 'save' | 'delete'>(null)

  function toggleRepeatWeekday(day: number) {
    setRepeatWeekdays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  // Fire confetti when celebration activates
  useEffect(() => {
    if (!showCelebration) return
    const canvas = confettiCanvasRef.current
    if (!canvas) return
    const myConfetti = confetti.create(canvas, { resize: true, useWorker: false })
    const end = Date.now() + 4500
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']
    const frame = () => {
      myConfetti({
        particleCount: 5,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.7 },
        colors,
        gravity: 0.8,
      })
      myConfetti({
        particleCount: 5,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.7 },
        colors,
        gravity: 0.8,
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [showCelebration])

  function handleLeadIdChange(value: string) {
    setLeadId(value)
    if (!value) {
      setStatus('AGENDADA')
      setConvertedToSale(null)
      setSaleValue('')
      return
    }

    if (mode !== 'create') return
    const note = leads?.find((lead) => lead.id === value)?.notes ?? ''
    if (note && (description === '' || description === autoFilledNote)) {
      setDescription(note)
      setAutoFilledNote(note)
    }
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value)
    const category = categories?.find((item) => item.id === value)
    const normalized = category?.name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '') ?? ''
    const nextStatus: AgendaEventStatus = normalized.includes('nao realizada') || normalized.includes('nao-realizada')
      ? 'NAO_REALIZADA'
      : normalized.includes('falta')
        ? 'FALTA'
        : normalized.includes('realizada')
          ? 'REALIZADA'
          : normalized.includes('cancelada')
            ? 'CANCELADA'
            : 'AGENDADA'

    setStatus(nextStatus)
    if (nextStatus !== 'REALIZADA') {
      setConvertedToSale(null)
      setSaleValue('')
    }
  }

  const isPending =
    createEvent.isPending || updateEvent.isPending || deleteEvent.isPending ||
    createSeries.isPending || updateSeries.isPending || deleteSeries.isPending || updateLead.isPending

  function buildIso(time: string): string {
    return new Date(`${dateValue}T${time}:00`).toISOString()
  }

  async function afterEventSaved() {
    if (showSaleQuestion && convertedToSale === true && saleValue) {
      const val = parseFloat(saleValue.replace(',', '.'))
      if (!isNaN(val) && val > 0) {
        const closedStage = stages?.find((stage) => stage.name.trim().toLocaleLowerCase('pt-BR') === 'fechados')
        if (!leadId || !closedStage) {
          setError(!leadId
            ? 'Vincule um lead para registrar a venda.'
            : 'A etapa Fechados não foi encontrada no pipeline.')
          return
        }
        try {
          await updateLead.mutateAsync({ id: leadId, stageId: closedStage.id, value: val })
          setCelebrationValue(val)
          setShowCelebration(true)
          return
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Não foi possível registrar a venda no CRM.')
          return
        }
      }
    }
    onClose()
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

    if (showSaleQuestion && convertedToSale === null) {
      setError('Informe se houve conversão em venda')
      return
    }
    if (showSaleQuestion && convertedToSale === true && !saleValue.trim()) {
      setError('Informe o valor da venda')
      return
    }
    if (showSaleQuestion && convertedToSale === true && !leadId) {
      setError('Vincule o lead antes de registrar uma venda')
      return
    }

    const payload = { title: title.trim(), description: description.trim() || null, startsAt, endsAt, categoryId: categoryId || null, leadId: leadId || null, status }

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
          onSuccess: afterEventSaved,
          onError: (err) => setError(err instanceof Error ? err.message : 'Erro ao salvar'),
        }
      )
    } else if (mode === 'create') {
      createEvent.mutate(payload, {
        onSuccess: afterEventSaved,
        onError: (err) => setError(err instanceof Error ? err.message : 'Erro ao salvar'),
      })
    } else if (event?.seriesId) {
      setSeriesChoice('save')
    } else if (event) {
      updateEvent.mutate(
        { id: event.id, ...payload, status },
        {
          onSuccess: afterEventSaved,
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
            onSuccess: afterEventSaved,
            onError: (err) => setError(err instanceof Error ? err.message : 'Erro ao salvar'),
          }
        )
      } else {
        updateEvent.mutate(
          { id: event.id, ...payload, startsAt, endsAt, status },
          {
            onSuccess: afterEventSaved,
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
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-[#07080c]/50 border border-white/[0.08] focus:border-blue-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
            >
              <option value="">Sem categoria</option>
              {(categories || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sale conversion question — appears when status is REALIZADA and wasn't before */}
          {showSaleQuestion && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Converteu em venda?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConvertedToSale(true)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                    convertedToSale === true
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300'
                  }`}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => { setConvertedToSale(false); setSaleValue('') }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                    convertedToSale === false
                      ? 'bg-slate-600 border-slate-500 text-white'
                      : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:border-slate-500/40 hover:text-slate-300'
                  }`}
                >
                  Não
                </button>
              </div>
              {convertedToSale === true && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Valor da venda (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={saleValue}
                    onChange={(e) => setSaleValue(e.target.value)}
                    placeholder="Ex: 2500"
                    className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-[#07080c]/50 border border-emerald-500/30 focus:border-emerald-500/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all duration-200"
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Lead vinculado</label>
            <div className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <input
                  ref={leadInputRef}
                  type="text"
                  value={leadDropdownOpen ? leadSearch : (selectedLead ? getLeadDisplayName(selectedLead) : '')}
                  placeholder="Buscar lead por nome ou telefone..."
                  onFocus={() => { setLeadDropdownOpen(true); setLeadSearch('') }}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  onBlur={() => setTimeout(() => setLeadDropdownOpen(false), 150)}
                  className="w-full pl-9 pr-7 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] focus:bg-[#07080c]/50 border border-white/[0.08] focus:border-blue-500/40 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
                />
                {leadId && !leadDropdownOpen && (
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleLeadIdChange(''); setLeadSearch('') }}
                    className="absolute right-2.5 text-slate-500 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {leadDropdownOpen && (
                <div className="absolute z-20 top-full mt-1 w-full bg-[#0c0e17] border border-white/[0.12] rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
                  <button
                    type="button"
                    onMouseDown={() => { handleLeadIdChange(''); setLeadSearch(''); setLeadDropdownOpen(false) }}
                    className="w-full text-left px-3.5 py-2 text-sm text-slate-500 hover:text-white hover:bg-white/[0.06] border-b border-white/[0.06]"
                  >
                    Sem lead
                  </button>
                  {filteredLeads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onMouseDown={() => { handleLeadIdChange(lead.id); setLeadSearch(''); setLeadDropdownOpen(false) }}
                      className="w-full text-left px-3.5 py-2 text-sm text-white hover:bg-white/[0.06] flex items-center gap-2"
                    >
                      {lead.temperature && <span className="text-[12px] shrink-0">{lead.temperature}</span>}
                      <span className="truncate">{getLeadDisplayName(lead)}</span>
                      <span className="text-slate-500 text-xs shrink-0 ml-auto">{formatPhoneNumber(lead.phone)}</span>
                    </button>
                  ))}
                  {filteredLeads.length === 0 && (
                    <div className="px-3.5 py-3 text-sm text-slate-500">Nenhum lead encontrado</div>
                  )}
                </div>
              )}
            </div>
          </div>


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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 cursor-pointer disabled:opacity-50 active:scale-95 transition-all duration-200"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>

              {event?.leadId && onOpenLeadInCrm && (
                <button
                  type="button"
                  onClick={() => { onOpenLeadInCrm(event.leadId!); onClose() }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-all duration-200 shadow-[0_0_12px_rgba(37,211,102,0.35)] hover:shadow-[0_0_20px_rgba(37,211,102,0.55)] hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #128C7E 0%, #25D366 100%)' }}
                  title="Abrir conversa no WhatsApp"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
                    <path fill="white" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </button>
              )}
            </div>
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

        {/* Celebration overlay */}
        {showCelebration && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden rounded-2xl">
            <canvas
              ref={confettiCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
            <div className="relative z-10 flex flex-col items-center gap-5 text-center px-8 animate-in fade-in zoom-in-90 duration-300">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400/20 to-emerald-500/20 border border-yellow-400/30 flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.3)]">
                <Trophy className="w-9 h-9 text-yellow-400" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-black text-white tracking-tight">Venda registrada!</p>
                <p className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-emerald-400">
                  R$ {celebrationValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-400 mt-1">incluído automaticamente no painel</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-8 py-3 bg-gradient-to-r from-yellow-500 to-emerald-500 hover:from-yellow-400 hover:to-emerald-400 text-white text-sm font-black uppercase tracking-wider rounded-2xl cursor-pointer shadow-[0_4px_20px_rgba(234,179,8,0.3)] active:scale-95 transition-all duration-200"
              >
                Fechar
              </button>
            </div>
            {/* Dark overlay behind content */}
            <div className="absolute inset-0 bg-[#07080c]/90 -z-[1]" />
          </div>
        )}
      </div>
    </div>
  )
}
