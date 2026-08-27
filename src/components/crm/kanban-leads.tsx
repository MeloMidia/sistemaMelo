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
import { useStages, useCreateStage, useUpdateLead, useCrmStream, useLeadsByLabel, useReorderStages, useMoveAllLeads } from '@/hooks/crm-api'
import { LeadColumn } from './lead-column'
import { LeadPanel } from './lead-panel'
import { LeadCard } from './lead-card'
import { FollowUpBoard } from './follow-up-board'
import { CampaignsView } from './campaigns-view'
import type { Lead, LeadStage } from '@/types/crm'
import { Plus, Loader2, Search, X, Download, Tag, Layers, Hash, Clock, Megaphone, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { getLeadDisplayName } from '@/lib/phone'
import { WhatsappImportModal } from './whatsapp-import-modal'

const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

function TagsView({
  searchQuery,
  onSelectLead,
}: {
  searchQuery: string
  onSelectLead: (id: string) => void
}) {
  const { data: columns = [], isLoading } = useLeadsByLabel()

  const q = searchQuery.trim().toLowerCase()

  const filtered = q
    ? columns.map((col) => ({
        ...col,
        leads: col.leads.filter((lead) => {
          const name = getLeadDisplayName(lead).toLowerCase()
          const phone = lead.phone.replace(/\D/g, '')
          return name.includes(q) || phone.includes(q.replace(/\D/g, ''))
        }),
      }))
    : columns

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="text-sm text-slate-500">Carregando etiquetas...</span>
        </div>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Hash className="w-10 h-10 text-slate-700" />
          <span className="text-sm text-slate-500">Nenhuma etiqueta encontrada</span>
          <span className="text-xs text-slate-600">Importe leads do WhatsApp para sincronizar as etiquetas</span>
        </div>
      </div>
    )
  }

  const totalTagged = filtered.reduce((sum, col) => sum + col._count.leads, 0)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-6 py-2 border-b border-white/[0.04] bg-[#07080c]/40 shrink-0 flex items-center gap-3">
        <span className="text-xs text-slate-500">
          <span className="text-white font-semibold tabular-nums">{totalTagged.toLocaleString('pt-BR')}</span> leads em{' '}
          <span className="text-white font-semibold tabular-nums">{columns.length}</span> etiquetas
        </span>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-5">
        <div className="flex gap-4 items-start h-full">
          {filtered.map((col) => (
            <div key={col.id} className="w-[290px] shrink-0 flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              <div
                className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl border shrink-0"
                style={{ backgroundColor: `${col.color}10`, borderColor: `${col.color}20` }}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                <span className="text-sm font-semibold truncate" style={{ color: col.color }}>
                  {col.name}
                </span>
                <span
                  className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-md tabular-nums shrink-0"
                  style={{ backgroundColor: `${col.color}18`, color: col.color }}
                >
                  {col._count.leads > col.leads.length
                    ? `${col.leads.length} de ${col._count.leads}`
                    : col._count.leads}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {col.leads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.06] p-6 text-center text-xs text-slate-600">
                    Sem leads
                  </div>
                ) : (
                  col.leads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} disableDrag onSelect={() => onSelectLead(lead.id)} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function KanbanLeads({ openLeadId }: { openLeadId?: string | null }) {
  const { data: stages, isLoading } = useStages()
  const createStage = useCreateStage()
  const updateLead = useUpdateLead()
  useCrmStream()
  const queryClient = useQueryClient()

  const reorderStages = useReorderStages()
  const moveAllLeads = useMoveAllLeads()

  const [syncResult, setSyncResult] = useState<{ leadsChecked: number; totalImported: number; totalFetched: number; leadsWithError: number; errors?: string[] } | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const syncAll = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/cron/sync-messages')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha ao sincronizar')
      return data
    },
    onSuccess: (data) => {
      setSyncResult(data)
      setSyncError(null)
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] })
    },
    onError: (err) => {
      setSyncError(err instanceof Error ? err.message : 'Erro desconhecido')
      setSyncResult(null)
    },
  })

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(openLeadId ?? null)
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [activeColumn, setActiveColumn] = useState<LeadStage | null>(null)
  const [movingStageId, setMovingStageId] = useState<string | null>(null)
  const [isAddingStage, setIsAddingStage] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [viewMode, setViewMode] = useState<'stages' | 'etiquetas' | 'follow-up' | 'campanhas'>('stages')
  // Ordem local das colunas durante o drag — evita mutação do cache do react-query
  // que causava loop infinito (setQueryData → re-render → onDragOver → setQueryData…)
  const [dragColOrder, setDragColOrder] = useState<string[] | null>(null)

  const dragStartSnapshotRef = useRef<LeadStage[] | null>(null)
  const activeTypeRef = useRef<'lead' | 'column' | null>(null)
  // Último stageId "over" durante drag de coluna — evita oscillação A↔B
  const lastColOverRef = useRef<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    dragStartSnapshotRef.current = queryClient.getQueryData<LeadStage[]>(['crm-stages']) ?? null

    if (active.data.current?.type === 'column') {
      activeTypeRef.current = 'column'
      const stageId = active.data.current.stageId as string
      const currentStages = queryClient.getQueryData<LeadStage[]>(['crm-stages'])
      setActiveColumn(currentStages?.find((s) => s.id === stageId) ?? null)
      setDragColOrder(currentStages?.map((s) => s.id) ?? null)
      lastColOverRef.current = null
    } else {
      activeTypeRef.current = 'lead'
      setActiveLead(active.data.current?.lead as Lead)
    }
  }, [queryClient])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    // ——— Coluna sendo arrastada: reordena via estado local (sem tocar o cache) ———
    if (activeTypeRef.current === 'column') {
      const activeStageId = active.data.current?.stageId as string
      const overId = over.id.toString()

      let overStageId: string | null = null
      if (overId.startsWith('stage-droppable-')) {
        overStageId = overId.replace('stage-droppable-', '')
      } else if (over.data.current?.stageId) {
        overStageId = over.data.current.stageId as string
      } else if (over.data.current?.lead) {
        overStageId = (over.data.current.lead as Lead).stageId
      }

      // Só reordena quando muda de coluna (evita oscillação A↔B)
      if (overStageId && overStageId !== activeStageId && overStageId !== lastColOverRef.current) {
        lastColOverRef.current = overStageId
        setDragColOrder((prev) => {
          const order = prev ?? (stages || []).map((s) => s.id)
          const fromIdx = order.indexOf(activeStageId)
          const toIdx = order.indexOf(overStageId!)
          if (fromIdx === -1 || toIdx === -1) return prev
          const result = [...order]
          result.splice(fromIdx, 1)
          result.splice(toIdx, 0, activeStageId)
          return result
        })
      }
      return
    }

    // ——— Lead sendo arrastado ———
    const activeLeadId = active.id as string
    const currentStages = queryClient.getQueryData<LeadStage[]>(['crm-stages'])
    if (!currentStages) return

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
      queryClient.setQueryData<LeadStage[]>(['crm-stages'], (old) => {
        if (!old) return old
        return old.map((stage) => {
          if (stage.id === activeStageId) {
            return { ...stage, leads: stage.leads.filter((l) => l.id !== activeLeadId) }
          }
          if (stage.id === targetStageId) {
            return { ...stage, leads: [...stage.leads, { ...activeLeadData!, stageId: targetStageId! }] }
          }
          return stage
        })
      })
    }
  }, [queryClient, stages])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const trueSnapshot = dragStartSnapshotRef.current

    // ——— Fim do arraste de coluna ———
    if (activeTypeRef.current === 'column') {
      activeTypeRef.current = null
      setActiveColumn(null)

      const finalOrder = dragColOrder
      setDragColOrder(null)
      lastColOverRef.current = null

      if (!over || !finalOrder) return

      // Aplica a nova ordem no cache e salva no servidor
      queryClient.setQueryData<LeadStage[]>(['crm-stages'], (old) => {
        if (!old) return old
        return finalOrder.map((id) => old.find((s) => s.id === id)).filter(Boolean) as LeadStage[]
      })

      reorderStages.mutate(
        finalOrder.map((id, idx) => ({ id, order: (idx + 1) * 1000 })),
        {
          onError: () => {
            if (trueSnapshot) queryClient.setQueryData(['crm-stages'], trueSnapshot)
            queryClient.invalidateQueries({ queryKey: ['crm-stages'] })
          },
        }
      )
      return
    }

    // ——— Fim do arraste de lead ———
    activeTypeRef.current = null
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

    updateLead.mutate(
      { id: activeLeadId, stageId: targetStageId },
      {
        onError: () => {
          if (trueSnapshot) queryClient.setQueryData(['crm-stages'], trueSnapshot)
          queryClient.invalidateQueries({ queryKey: ['crm-stages'] })
        },
      }
    )
  }, [queryClient, updateLead, reorderStages, dragColOrder])

  const handleMoveAll = useCallback((fromStageId: string, toStageId: string) => {
    setMovingStageId(fromStageId)
    moveAllLeads.mutate(
      { fromStageId, toStageId },
      { onSettled: () => setMovingStageId(null) }
    )
  }, [moveAllLeads])

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

  // Durante drag de coluna, usa a ordem local (dragColOrder) sem tocar no cache
  const orderedStages = dragColOrder
    ? dragColOrder.map((id) => (stages || []).find((s) => s.id === id)).filter(Boolean) as LeadStage[]
    : (stages || [])

  const visibleStages = q
    ? orderedStages.map((stage) => ({
        ...stage,
        leads: stage.leads.filter((lead) => {
          const name = getLeadDisplayName(lead).toLowerCase()
          const phone = lead.phone.replace(/\D/g, '')
          return name.includes(q) || phone.includes(q.replace(/\D/g, ''))
        }),
      }))
    : orderedStages

  const allLeads = (stages || []).flatMap((s) => s.leads)
  const stats = {
    // total usa o _count real do servidor (não o array limitado a 100/stage)
    total: (stages || []).reduce((sum, s) => sum + s._count.leads, 0),
    hot: allLeads.filter((l) => l.temperature === '🟢').length,
    warm: allLeads.filter((l) => l.temperature === '🟡').length,
    cold: allLeads.filter((l) => l.temperature === '🔴').length,
    value: allLeads.reduce((sum, l) => sum + (l.value ?? 0), 0),
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header: stats + busca */}
      <div className="px-6 h-14 shrink-0 flex items-center justify-between gap-4 min-w-0"
        style={{ background: 'var(--nm-bg)', borderBottom: '1px solid var(--nm-border)' }}>
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

        {/* Busca + toggle + importar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar lead..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-7 py-1.5 rounded-lg text-sm text-white placeholder:text-slate-600 outline-none w-52 transition-all"
              style={{
                background: 'var(--nm-bg)',
                boxShadow: 'inset -3px -3px 7px var(--nm-light), inset 3px 3px 7px var(--nm-dark)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
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

          {/* Toggle de visualização */}
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-lg shrink-0"
            style={{ background: 'var(--nm-bg)', boxShadow: 'inset -2px -2px 5px var(--nm-light), inset 2px 2px 5px var(--nm-dark)', border: '1px solid var(--nm-border)' }}
          >
            <button
              onClick={() => setViewMode('stages')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer ${
                viewMode === 'stages'
                  ? 'bg-blue-600/80 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Stages
            </button>
            <button
              onClick={() => setViewMode('etiquetas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer ${
                viewMode === 'etiquetas'
                  ? 'bg-green-600/80 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              Etiquetas
            </button>
            <button
              onClick={() => setViewMode('follow-up')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer ${
                viewMode === 'follow-up'
                  ? 'bg-purple-600/80 text-white shadow-[0_0_10px_rgba(139,92,246,0.3)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Follow Up
            </button>
            <button
              onClick={() => setViewMode('campanhas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer ${
                viewMode === 'campanhas'
                  ? 'bg-blue-600/80 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              Campanhas
            </button>
          </div>

          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={() => { setSyncResult(null); setSyncError(null); syncAll.mutate() }}
              disabled={syncAll.isPending}
              title="Sincronizar mensagens recentes do WhatsApp"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/[0.08] border border-blue-500/20 text-blue-400 hover:bg-blue-500/[0.15] hover:text-blue-300 text-xs font-medium transition-all cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncAll.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {syncAll.isPending ? 'Sincronizando...' : 'Sincronizar'}
            </button>
            {syncResult && (
              <span className={`text-[10px] tabular-nums ${syncResult.totalImported > 0 ? 'text-emerald-400' : syncResult.leadsWithError > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                {syncResult.leadsWithError > 0
                  ? `Erro em ${syncResult.leadsWithError} leads — ${syncResult.errors?.[0] ?? 'falha na Evolution API'}`
                  : syncResult.totalFetched === 0
                    ? `${syncResult.leadsChecked} leads — Evolution API sem mensagens`
                    : syncResult.totalImported > 0
                      ? `+${syncResult.totalImported} novas de ${syncResult.totalFetched} buscadas`
                      : `${syncResult.totalFetched} msgs buscadas — todas já estavam no CRM`}
              </span>
            )}
            {syncError && (
              <span className="text-[10px] text-red-400 max-w-[220px] truncate" title={syncError}>
                Erro: {syncError}
              </span>
            )}
          </div>

          <button
            onClick={() => setShowImport(true)}
            title="Importar leads do WhatsApp"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/[0.08] border border-green-500/20 text-green-400 hover:bg-green-500/[0.15] hover:text-green-300 text-xs font-medium transition-all cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Importar WA
          </button>
        </div>
      </div>

    {viewMode === 'stages' ? (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto p-5" style={{ background: 'var(--nm-bg)' }}>
          <div className="flex gap-4 items-start min-h-[calc(100vh-170px)]">
            {visibleStages.map((stage) => (
              <LeadColumn
                key={stage.id}
                stage={stage}
                onSelectLead={setSelectedLeadId}
                otherStages={visibleStages
                  .filter((s) => s.id !== stage.id)
                  .map((s) => ({ id: s.id, name: s.name, color: s.color }))}
                onMoveAll={(toStageId) => handleMoveAll(stage.id, toStageId)}
                isMovingAll={movingStageId === stage.id}
              />
            ))}

            {isAddingStage ? (
              <div
                className="w-[285px] shrink-0 p-4 rounded-2xl space-y-3"
                style={{ background: 'var(--nm-bg)', boxShadow: '-5px -5px 12px var(--nm-light), 5px 5px 12px var(--nm-dark)', border: '1px solid var(--nm-border)' }}
              >
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
                  className="rounded-xl text-white placeholder:text-slate-600"
                  style={{ background: 'var(--nm-bg)', boxShadow: 'inset -3px -3px 7px var(--nm-light), inset 3px 3px 7px var(--nm-dark)', border: '1px solid rgba(255,255,255,0.04)' }}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddStage} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs cursor-pointer rounded-lg border-0">
                    Criar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsAddingStage(false); setNewStageName('') }} className="text-slate-500 hover:text-white text-xs cursor-pointer">
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingStage(true)}
                className="w-[285px] shrink-0 p-4 rounded-2xl cursor-pointer flex items-center justify-center gap-2 text-sm font-medium transition-all duration-200"
                style={{
                  background: 'var(--nm-bg)',
                  boxShadow: 'inset -3px -3px 8px var(--nm-light), inset 3px 3px 8px var(--nm-dark)',
                  border: '1px solid var(--nm-border)',
                  color: 'var(--nm-text-muted)',
                }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { boxShadow: '-5px -5px 12px var(--nm-light), 5px 5px 12px var(--nm-dark)', color: 'var(--nm-text-secondary)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { boxShadow: 'inset -3px -3px 8px var(--nm-light), inset 3px 3px 8px var(--nm-dark)', color: 'var(--nm-text-muted)' })}
              >
                <Plus className="w-4 h-4" />
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
          ) : activeColumn ? (
            <div className="w-[290px] rotate-1 opacity-80 shadow-2xl">
              <div
                className="px-4 py-3 rounded-2xl border backdrop-blur-xl"
                style={{
                  backgroundColor: `${activeColumn.color}15`,
                  borderColor: `${activeColumn.color}40`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeColumn.color }} />
                  <span className="text-sm font-bold" style={{ color: activeColumn.color }}>
                    {activeColumn.name}
                  </span>
                  <span className="ml-auto text-[11px] opacity-60" style={{ color: activeColumn.color }}>
                    {activeColumn._count.leads}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    ) : viewMode === 'etiquetas' ? (
      <TagsView searchQuery={searchQuery} onSelectLead={setSelectedLeadId} />
    ) : viewMode === 'follow-up' ? (
      <FollowUpBoard searchQuery={searchQuery} onSelectLead={setSelectedLeadId} />
    ) : (
      <CampaignsView />
    )}

    {selectedLeadId && <LeadPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
    {showImport && <WhatsappImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
