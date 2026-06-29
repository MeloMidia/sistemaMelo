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
import { Plus, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useQueryClient } from '@tanstack/react-query'

const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

export function KanbanLeads() {
  const { data: stages, isLoading } = useStages()
  const createStage = useCreateStage()
  const updateLead = useUpdateLead()
  useCrmStream()
  const queryClient = useQueryClient()

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [isAddingStage, setIsAddingStage] = useState(false)
  const [newStageName, setNewStageName] = useState('')

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-5 items-start min-h-[calc(100vh-180px)]">
          {(stages || []).map((stage) => (
            <LeadColumn key={stage.id} stage={stage} onSelectLead={setSelectedLeadId} />
          ))}

          {isAddingStage ? (
            <div className="w-[330px] shrink-0 p-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] space-y-3">
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
              className="w-[330px] shrink-0 p-4 rounded-2xl border-2 border-dashed border-white/[0.06] text-slate-500 hover:text-white hover:border-blue-500/30 hover:bg-blue-500/[0.03] cursor-pointer flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus className="w-5 h-5" />
              Nova etapa
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="w-[304px] rotate-2 opacity-95 shadow-2xl">
            <LeadCard lead={activeLead} isOverlay={true} />
          </div>
        ) : null}
      </DragOverlay>

      {selectedLeadId && <LeadPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
    </DndContext>
  )
}
