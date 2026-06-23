// src/components/crm/kanban-leads.tsx
'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useStages, useCreateStage, useUpdateLead, useCrmStream } from '@/hooks/crm-api'
import { LeadColumn } from './lead-column'
import { LeadPanel } from './lead-panel'
import type { Lead } from '@/types/crm'
import { Plus, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

export function KanbanLeads() {
  const { data: stages, isLoading } = useStages()
  const createStage = useCreateStage()
  const updateLead = useUpdateLead()
  useCrmStream()

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [isAddingStage, setIsAddingStage] = useState(false)
  const [newStageName, setNewStageName] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const lead = active.data.current?.lead as Lead | undefined
    const targetStageId = over.data.current?.stageId as string | undefined
    if (!lead || !targetStageId || lead.stageId === targetStageId) return

    updateLead.mutate({ id: lead.id, stageId: targetStageId })
  }

  function handleAddStage() {
    if (newStageName.trim()) {
      const color = STAGE_COLORS[Math.floor(Math.random() * STAGE_COLORS.length)]
      createStage.mutate({ name: newStageName.trim(), color })
      setNewStageName('')
      setIsAddingStage(false)
    }
  }

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
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
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

      {selectedLeadId && <LeadPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
    </DndContext>
  )
}
