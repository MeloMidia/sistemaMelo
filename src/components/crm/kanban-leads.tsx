// src/components/crm/kanban-leads.tsx
'use client'

import { useState, useCallback, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { useStages, useCreateStage, useUpdateLead, useCrmStream } from '@/hooks/crm-api'
import { LeadColumn } from './lead-column'
import { LeadPanel } from './lead-panel'
import { LeadCard } from './lead-card'
import type { Lead, LeadStage } from '@/types/crm'
import { Plus, Loader2, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useQueryClient } from '@tanstack/react-query'
import { getLeadDisplayName } from '@/lib/phone'

const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

export function KanbanLeads({ openLeadId }: { openLeadId?: string | null }) {
  const { data: stages, isLoading } = useStages()
  const createStage = useCreateStage()
  const updateLead = useUpdateLead()
  useCrmStream()
  const queryClient = useQueryClient()

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(openLeadId ?? null)
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [isAddingStage, setIsAddingStage] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Snapshot do estado REAL antes de qualquer reordenação otimista do
  // dragOver — handleDragOver já escreve no cache ['crm-stages'] durante o
  // arraste, então o onMutate/onError do useUpdateLead captura um estado
  // já alterado. Guardamos aqui o estado verdadeiro pra poder restaurar
  // corretamente se o PUT falhar.
  const dragStartSnapshotRef = useRef<LeadStage[] | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    setActiveLead(active.data.current?.lead as Lead)
    dragStartSnapshotRef.current = queryClient.getQueryData<LeadStage[]>(['crm-stages']) ?? null
  }, [queryClient])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeLeadId = active.id as string
    const currentStages = queryClient.getQueryData<LeadStage[]>(['crm-stages'])
    if (!currentStages) return

    // Find the lead and its current stage in the cache
    let activeStageId: string | null = null
    let activeLeadData: Lead | null = null

    for (const stage of currentStages) {
      const found = stage.leads.find((l) => l.id === activeLeadId)
      if (found) {
        activeStageId = stage.id
        activeLeadData = found
        break
      }
    }

    if (!activeStageId || !activeLeadData) return

    // Find target stage ID
    const overData = over.data.current
    let targetStageId: string | null = null

    if (overData?.stageId) {
      targetStageId = overData.stageId as string
    } else if (overData?.lead) {
      targetStageId = (overData.lead as Lead).stageId
    } else if (over.id.toString().startsWith('stage-droppable-')) {
      targetStageId = over.id.toString().replace('stage-droppable-', '')
    }

    if (targetStageId && targetStageId !== activeStageId) {
      // Optimistically update stages in cache
      queryClient.setQueryData<LeadStage[]>(['crm-stages'], (old) => {
        if (!old) return old
        return old.map((stage) => {
          if (stage.id === activeStageId) {
            return {
              ...stage,
              leads: stage.leads.filter((l) => l.id !== activeLeadId),
            }
          }
          if (stage.id === targetStageId) {
            return {
              ...stage,
              leads: [...stage.leads, { ...activeLeadData!, stageId: targetStageId! }],
            }
          }
          return stage
        })
      })
    }
  }, [queryClient])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveLead(null)
    if (!over) return

    const activeLeadId = active.id as string
    const overData = over.data.current
    let targetStageId: string | null = null

    if (overData?.stageId) {
      targetStageId = overData.stageId as string
    } else if (overData?.lead) {
      targetStageId = (overData.lead as Lead).stageId
    } else if (over.id.toString().startsWith('stage-droppable-')) {
      targetStageId = over.id.toString().replace('stage-droppable-', '')
    }

    if (!targetStageId) return

    const originalLead = active.data.current?.lead as Lead | undefined
    if (!originalLead || originalLead.stageId === targetStageId) return

    const trueSnapshot = dragStartSnapshotRef.current

    updateLead.mutate(
      { id: activeLeadId, stageId: targetStageId },
      {
        onError: () => {
          // useUpdateLead's próprio onError já restaurou um snapshot, mas
          // esse snapshot foi tirado DEPOIS do handleDragOver já ter movido
          // o lead no cache — ou seja, é o estado pós-drag, não o original.
          // Restauramos aqui o snapshot verdadeiro (de antes do drag) e, por
          // segurança, invalidamos para confirmar com o servidor.
          if (trueSnapshot) {
            queryClient.setQueryData(['crm-stages'], trueSnapshot)
          }
          queryClient.invalidateQueries({ queryKey: ['crm-stages'] })
        }
      }
    )
  }, [queryClient, updateLead])

  const handleAddStage = useCallback(() => {
    if (newStageName.trim()) {
      const color = STAGE_COLORS[Math.floor(Math.random() * STAGE_COLORS.length)]
      createStage.mutate({ name: newStageName.trim(), color })
      setNewStageName('')
      setIsAddingStage(false)
    }
  }, [newStageName, createStage])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="text-sm text-slate-500">Carregando leads...</span>
        </div>
      </div>
    )
  }

  const q = searchQuery.trim().toLowerCase()
  const visibleStages = q
    ? (stages || []).map((stage) => ({
        ...stage,
        leads: stage.leads.filter((lead) => {
          const name = getLeadDisplayName(lead).toLowerCase()
          const phone = lead.phone.replace(/\D/g, '')
          return name.includes(q) || phone.includes(q.replace(/\D/g, ''))
        }),
      }))
    : (stages || [])

  const allLeads = (stages || []).flatMap((s) => s.leads)
  const stats = {
    total: allLeads.length,
    hot: allLeads.filter((l) => l.temperature === '🟢').length,
    warm: allLeads.filter((l) => l.temperature === '🟡').length,
    cold: allLeads.filter((l) => l.temperature === '🔴').length,
    value: allLeads.reduce((sum, l) => sum + (l.value ?? 0), 0),
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header: stats + busca */}
      <div className="px-6 h-14 border-b border-white/[0.05] bg-[#07080c]/80 backdrop-blur-md shrink-0 flex items-center justify-between gap-6">
        {/* Stats */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-bold text-white tabular-nums">{stats.total}</span>
            <span className="text-xs text-slate-500 font-medium">leads</span>
          </div>
          {(stats.hot > 0 || stats.warm > 0 || stats.cold > 0) && (
            <div className="w-px h-4 bg-white/[0.07]" />
          )}
          {stats.hot > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b98180]" />
              <span className="text-sm font-semibold text-white tabular-nums">{stats.hot}</span>
              <span className="text-xs text-slate-500">quentes</span>
            </div>
          )}
          {stats.warm > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b80]" />
              <span className="text-sm font-semibold text-white tabular-nums">{stats.warm}</span>
              <span className="text-xs text-slate-500">mornos</span>
            </div>
          )}
          {stats.cold > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_#ef444480]" />
              <span className="text-sm font-semibold text-white tabular-nums">{stats.cold}</span>
              <span className="text-xs text-slate-500">frios</span>
            </div>
          )}
          {stats.value > 0 && (
            <>
              <div className="w-px h-4 bg-white/[0.07]" />
              <span className="text-sm font-semibold text-emerald-400 tabular-nums">
                R$ {stats.value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </>
          )}
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar lead..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-7 py-1.5 bg-white/[0.04] border border-white/[0.07] rounded-lg text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all w-52"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-x-auto p-5">
        <div className="flex gap-4 items-start min-h-[calc(100vh-170px)]">
          {visibleStages.map((stage) => (
            <LeadColumn key={stage.id} stage={stage} onSelectLead={setSelectedLeadId} />
          ))}

          {isAddingStage ? (
            <div className="w-[290px] shrink-0 p-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] space-y-3">
              <Input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddStage()
                  if (e.key === 'Escape') {
                    setIsAddingStage(false)
                    setNewStageName('')
                  }
                }}
                placeholder="Nome da etapa..."
                autoFocus
                className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 rounded-xl"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddStage}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs cursor-pointer rounded-lg"
                >
                  Criar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingStage(false)
                    setNewStageName('')
                  }}
                  className="text-slate-500 hover:text-white text-xs cursor-pointer"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingStage(true)}
              className="w-[290px] shrink-0 p-4 rounded-2xl border-2 border-dashed border-white/[0.06] text-slate-500 hover:text-white hover:border-blue-500/30 hover:bg-blue-500/[0.03] cursor-pointer flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus className="w-5 h-5" />
              Nova etapa
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="w-[290px] rotate-2 opacity-95 shadow-2xl">
            <LeadCard lead={activeLead} isOverlay={true} />
          </div>
        ) : null}
      </DragOverlay>

      {selectedLeadId && <LeadPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
    </DndContext>
    </div>
  )
}
