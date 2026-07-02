'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { startOfWeek, addDays, endOfWeek, formatWeekRangeLabel } from '@/lib/agenda-date'
import { useAgendaEvents, useEventCategories, useUpdateAgendaEvent } from '@/hooks/agenda-api'
import { MiniCalendar } from './mini-calendar'
import { CategorySidebar } from './category-sidebar'
import { WeekGrid } from './week-grid'
import { EventModal } from './event-modal'
import type { AgendaEvent } from '@/types/agenda'

type ModalState =
  | { mode: 'create'; date: Date; hour: number }
  | { mode: 'edit'; event: AgendaEvent }
  | null

export function AgendaView({ onOpenLeadInCrm }: { onOpenLeadInCrm?: (leadId: string) => void }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<Set<string>>(new Set())
  const [modalState, setModalState] = useState<ModalState>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const knownCategoryIdsRef = useRef<Set<string>>(new Set())

  const weekEnd = endOfWeek(weekStart)
  const { data: events } = useAgendaEvents(weekStart, weekEnd)
  const { data: categories } = useEventCategories()
  const updateEvent = useUpdateAgendaEvent()

  // Toda categoria nova entra visível por padrão, mas categorias já vistas
  // antes (mesmo escondidas pelo usuário) não são reativadas em refetches.
  useEffect(() => {
    if (!categories) return
    const newlySeenIds = categories
      .map((c) => c.id)
      .filter((id) => !knownCategoryIdsRef.current.has(id))
    if (newlySeenIds.length === 0) return
    for (const id of newlySeenIds) knownCategoryIdsRef.current.add(id)
    setVisibleCategoryIds((prev) => {
      const next = new Set(prev)
      for (const id of newlySeenIds) next.add(id)
      return next
    })
  }, [categories])

  function toggleCategory(id: string) {
    setVisibleCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const q = searchQuery.trim().toLowerCase()
  const filteredEvents = (events || []).filter((e) => {
    if (e.categoryId && !visibleCategoryIds.has(e.categoryId)) return false
    if (!q) return true
    if (e.title.toLowerCase().includes(q)) return true
    const leadName = e.lead?.name ?? ''
    if (leadName && leadName.toLowerCase().includes(q)) return true
    const leadPhone = e.lead?.phone ?? ''
    if (leadPhone && leadPhone.replace(/\D/g, '').includes(q.replace(/\D/g, ''))) return true
    return false
  })

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#07080c]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#07080c]/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setModalState({ mode: 'create', date: new Date(), hour: 9 })}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-[0_4px_12px_rgba(59,130,246,0.25)] hover:shadow-[0_4px_20px_rgba(59,130,246,0.4)] active:scale-95 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Criar
          </button>

          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-white border border-white/[0.08] hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.06] rounded-xl transition-all duration-200 cursor-pointer"
          >
            Hoje
          </button>

          <div className="flex gap-1 ml-1">
            <button
              type="button"
              onClick={() => setWeekStart((d) => addDays(d, -7))}
              className="w-8 h-8 rounded-full border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06] text-slate-400 hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeekStart((d) => addDays(d, 7))}
              className="w-8 h-8 rounded-full border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06] text-slate-400 hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer"
              aria-label="Próxima semana"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">
            {formatWeekRangeLabel(weekStart)}
          </span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar reunião ou contato..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-7 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40 focus:bg-white/[0.06] w-56 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-60 shrink-0 border-r border-white/[0.06] py-6 px-4 overflow-y-auto bg-[#090a0f]/30 backdrop-blur-md space-y-6">
          <MiniCalendar weekStart={weekStart} onSelectDate={(date) => setWeekStart(startOfWeek(date))} />
          <CategorySidebar visibleIds={visibleCategoryIds} onToggle={toggleCategory} />
        </aside>

        <WeekGrid
          weekStart={weekStart}
          events={filteredEvents}
          onCreateAt={(date, hour) => setModalState({ mode: 'create', date, hour })}
          onEditEvent={(event) => setModalState({ mode: 'edit', event })}
          onUpdateEvent={(id, startsAt, endsAt) => updateEvent.mutate({ id, startsAt, endsAt })}
          onOpenLeadInCrm={onOpenLeadInCrm}
        />
      </div>

      {modalState?.mode === 'create' && (
        <EventModal
          mode="create"
          initialDate={modalState.date}
          initialHour={modalState.hour}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.mode === 'edit' && (
        <EventModal mode="edit" event={modalState.event} onClose={() => setModalState(null)} />
      )}
    </div>
  )
}
