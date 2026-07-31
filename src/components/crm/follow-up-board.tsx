'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useFollowUp, useFollowUpLeadMove, useMoveAllFollowUpLeads } from '@/hooks/crm-api'
import { FollowUpColumn, FOLLOW_UP_COLORS } from './follow-up-column'
import { LeadCard } from './lead-card'
import type { Lead } from '@/types/crm'
import { Loader2, Clock } from 'lucide-react'
import { getLeadDisplayName } from '@/lib/phone'

interface FollowUpBoardProps {
  onSelectLead: (id: string) => void
  searchQuery: string
}

export function FollowUpBoard({ onSelectLead, searchQuery }: FollowUpBoardProps) {
  const { data: columns = [], isLoading } = useFollowUp()
  const moveLeadMutation = useFollowUpLeadMove()
  const moveAllMutation = useMoveAllFollowUpLeads()
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [movingColumn, setMovingColumn] = useState<number | null>(null)

  const handleMoveAll = useCallback((fromColumn: number, toColumn: number) => {
    setMovingColumn(fromColumn)
    moveAllMutation.mutate(
      { fromColumn, toColumn },
      { onSettled: () => setMovingColumn(null) }
    )
  }, [moveAllMutation])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const lead = e.active.data.current?.lead as Lead | undefined
    if (lead) setActiveLead(lead)
  }, [])

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveLead(null)
      const lead = e.active.data.current?.lead as Lead | undefined
      const overData = e.over?.data.current
      if (!lead || !overData || overData.type !== 'follow-up-column') return
      const targetColumn = overData.column as number
      if (lead.followUpColumn !== targetColumn) {
        moveLeadMutation.mutate({ leadId: lead.id, column: targetColumn })
      }
    },
    [moveLeadMutation]
  )

  const q = searchQuery.trim().toLowerCase()

  const filteredColumns = q
    ? columns.map((col) => ({
        ...col,
        leads: col.leads.filter((lead) => {
          const name = getLeadDisplayName(lead).toLowerCase()
          return name.includes(q) || lead.phone.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
        }),
      }))
    : columns

  const totalLeads = columns.reduce((sum, col) => sum + col._count.leads, 0)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <span className="text-sm text-slate-500">Carregando follow-up...</span>
        </div>
      </div>
    )
  }

  if (totalLeads === 0 && !q) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Clock className="w-10 h-10 text-slate-700" />
          <span className="text-sm text-slate-500">Nenhum lead em follow up</span>
          <span className="text-xs text-slate-600">
            Abra um lead e clique em "Enviar para Follow Up"
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Sub-header */}
      <div className="px-5 py-2 border-b border-white/[0.04] flex items-center gap-2 text-xs text-slate-500 shrink-0">
        <span className="text-white font-semibold tabular-nums">{totalLeads}</span>
        lead{totalLeads !== 1 ? 's' : ''} em follow up · arraste entre colunas para avançar o follow up
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto p-5">
          <div className="flex gap-4 items-start min-h-[calc(100vh-210px)]">
            {filteredColumns.map((col) => {
              const otherColumns = filteredColumns
                .filter((c) => c.column !== col.column)
                .map((c) => ({ column: c.column, color: FOLLOW_UP_COLORS[c.column - 1] }))
              return (
                <FollowUpColumn
                  key={col.column}
                  column={col.column}
                  leads={col.leads}
                  totalCount={col._count.leads}
                  onSelectLead={onSelectLead}
                  otherColumns={otherColumns}
                  onMoveAll={(toColumn) => handleMoveAll(col.column, toColumn)}
                  isMovingAll={movingColumn === col.column}
                />
              )
            })}
          </div>
        </div>

        <DragOverlay>
          {activeLead && <LeadCard lead={activeLead} isOverlay disableDrag />}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
