'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { startOfWeek, addDays, endOfWeek, formatWeekRangeLabel } from '@/lib/agenda-date'
import { useAgendaEvents, useEventCategories } from '@/hooks/agenda-api'
import { MiniCalendar } from './mini-calendar'
import { CategorySidebar } from './category-sidebar'
import { WeekGrid } from './week-grid'
import { EventModal } from './event-modal'
import type { AgendaEvent } from '@/types/agenda'

type ModalState =
  | { mode: 'create'; date: Date; hour: number }
  | { mode: 'edit'; event: AgendaEvent }
  | null

export function AgendaView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<Set<string>>(new Set())
  const [modalState, setModalState] = useState<ModalState>(null)
  const knownCategoryIdsRef = useRef<Set<string>>(new Set())

  const weekEnd = endOfWeek(weekStart)
  const { data: events } = useAgendaEvents(weekStart, weekEnd)
  const { data: categories } = useEventCategories()

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

  const filteredEvents = (events || []).filter(
    (e) => !e.categoryId || visibleCategoryIds.has(e.categoryId)
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#07080c]">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-white/[0.06] shrink-0">
        <button
          type="button"
          onClick={() => setModalState({ mode: 'create', date: new Date(), hour: 9 })}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-sm font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Criar
        </button>

        <button
          type="button"
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          className="px-3 py-1.5 text-sm text-slate-300 border border-white/[0.1] rounded-lg hover:bg-white/[0.06] cursor-pointer"
        >
          Hoje
        </button>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <span className="text-sm font-medium text-white">{formatWeekRangeLabel(weekStart)}</span>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-56 shrink-0 border-r border-white/[0.06] py-4 overflow-y-auto">
          <MiniCalendar weekStart={weekStart} onSelectDate={(date) => setWeekStart(startOfWeek(date))} />
          <CategorySidebar visibleIds={visibleCategoryIds} onToggle={toggleCategory} />
        </aside>

        <WeekGrid
          weekStart={weekStart}
          events={filteredEvents}
          onCreateAt={(date, hour) => setModalState({ mode: 'create', date, hour })}
          onEditEvent={(event) => setModalState({ mode: 'edit', event })}
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
