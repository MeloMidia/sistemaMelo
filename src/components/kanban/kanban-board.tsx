'use client'

import { useState, useCallback, useMemo } from 'react'
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
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useColumns, useCreateColumn, useReorderTasks, useReorderColumns } from '@/hooks/api'
import { KanbanColumn } from './kanban-column'
import { TaskCard } from './task-card'
import type { Task, Column } from '@/types'
import { Plus, Loader2, TrendingUp, ListFilter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useQueryClient } from '@tanstack/react-query'
import { useChurnDragHandler } from '@/hooks/use-churn-drag'
import { ChurnReasonModal } from '@/components/clientes/churn-reason-modal'

export function KanbanBoard({
  source = 'kanban',
  title,
  description,
  taskLabel = 'cliente',
}: {
  source?: string
  title?: string
  description?: string
  taskLabel?: string
}) {
  const { data: columns, isLoading } = useColumns(source)
  const createColumn = useCreateColumn(source)
  const reorderTasks = useReorderTasks()
  const reorderColumns = useReorderColumns()
  const queryClient = useQueryClient()
  const { pendingChurn, interceptDragEnd, confirmChurn, cancelChurn, isSaving: isSavingChurn } = useChurnDragHandler(source)

  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [isAddingColumn, setIsAddingColumn] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [selectedColumnId, setSelectedColumnId] = useState('')

  const selectedColumn = useMemo(
    () => (columns ?? []).find((column) => column.id === selectedColumnId) ?? null,
    [columns, selectedColumnId]
  )
  const visibleColumns = useMemo(
    () => (selectedColumn ? [selectedColumn] : (columns ?? [])),
    [columns, selectedColumn]
  )
  const showColumnFilter = source === 'kanban' && (columns?.length ?? 0) > 1

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    if (active.data.current?.type === 'task') {
      setActiveTask(active.data.current.task as Task)
    }
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current
    if (activeData?.type !== 'task') return

    // Always read current state from cache — activeData.task is stale after first move
    const currentColumns = queryClient.getQueryData<Column[]>(['columns', source])
    if (!currentColumns) return

    const activeTaskId = active.id as string

    // Find where the task currently lives in the cache
    let activeColumnId: string | null = null
    let activeTaskData: Task | null = null
    for (const col of currentColumns) {
      const found = col.tasks.find(t => t.id === activeTaskId)
      if (found) { activeColumnId = col.id; activeTaskData = found; break }
    }
    if (!activeColumnId || !activeTaskData) return

    const overData = over.data.current
    let overColumnId: string | null = null
    let isOverTask = false

    if (overData?.type === 'task') {
      isOverTask = true
      const overTaskId = over.id as string
      for (const col of currentColumns) {
        if (col.tasks.some(t => t.id === overTaskId)) {
          overColumnId = col.id
          break
        }
      }
    } else if (overData?.type === 'column') {
      overColumnId = overData.column.id as string
    } else if (over.id.toString().startsWith('column-droppable-')) {
      overColumnId = over.id.toString().replace('column-droppable-', '')
    }

    if (!overColumnId) return

    if (overColumnId !== activeColumnId) {
      // Dragging over a DIFFERENT column
      queryClient.setQueryData<Column[]>(['columns', source], (old) => {
        if (!old) return old
        return old.map((col) => {
          if (col.id === activeColumnId) {
            return { ...col, tasks: col.tasks.filter(t => t.id !== activeTaskId) }
          }
          if (col.id === overColumnId) {
            const newTasks = [...col.tasks]
            if (isOverTask) {
              const overIdx = col.tasks.findIndex(t => t.id === over.id)
              newTasks.splice(overIdx >= 0 ? overIdx : newTasks.length, 0, { ...activeTaskData!, columnId: overColumnId! })
            } else {
              newTasks.push({ ...activeTaskData!, columnId: overColumnId! })
            }
            return { ...col, tasks: newTasks }
          }
          return col
        })
      })
    } else if (isOverTask) {
      // Reordering within the SAME column
      queryClient.setQueryData<Column[]>(['columns', source], (old) => {
        if (!old) return old
        return old.map((col) => {
          if (col.id === activeColumnId) {
            const oldIdx = col.tasks.findIndex(t => t.id === activeTaskId)
            const newIdx = col.tasks.findIndex(t => t.id === over.id)
            if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
              return { ...col, tasks: arrayMove(col.tasks, oldIdx, newIdx) }
            }
          }
          return col
        })
      })
    }
  }, [queryClient, source])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over || !columns) return

    const activeData = active.data.current
    const overData = over.data.current

    if (activeData?.type === 'column-sortable') {
      if (overData?.type === 'column-sortable') {
        const oldIndex = columns.findIndex((c) => `column-${c.id}` === active.id)
        const newIndex = columns.findIndex((c) => `column-${c.id}` === over.id)

        if (oldIndex !== newIndex) {
          const reordered = arrayMove(columns, oldIndex, newIndex)
          const items = reordered.map((col, i) => ({ id: col.id, order: (i + 1) * 1000 }))

          queryClient.setQueryData<Column[]>(['columns', source], reordered)
          reorderColumns.mutate(items)
        }
      }
      return
    }

    if (activeData?.type === 'task') {
      // Cliente sendo movido para uma coluna de encerramento (só no board de clientes):
      // intercepta e pede o motivo antes de confirmar a posição.
      if (source === 'kanban' && interceptDragEnd(activeTask, active.id as string)) return

      const currentColumns = queryClient.getQueryData<Column[]>(['columns', source])
      if (!currentColumns) return

      const items: { id: string; columnId: string; order: number }[] = []
      currentColumns.forEach((col) => {
        col.tasks.forEach((task, idx) => {
          items.push({ id: task.id, columnId: col.id, order: (idx + 1) * 1000 })
        })
      })

      if (items.length > 0) {
        reorderTasks.mutate(items)
      }
    }
  }, [columns, queryClient, reorderTasks, reorderColumns, source, activeTask, interceptDragEnd])

  const handleAddColumn = () => {
    if (newColumnTitle.trim()) {
      createColumn.mutate(newColumnTitle.trim())
      setNewColumnTitle('')
      setIsAddingColumn(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="text-sm text-slate-500">Carregando board...</span>
        </div>
      </div>
    )
  }

  const columnIds = visibleColumns.map((c) => `column-${c.id}`)
  const workspaceClass = title || showColumnFilter ? 'flex flex-col overflow-hidden' : 'overflow-x-auto p-6'
  const boardScrollClass = title
    ? 'flex-1 min-h-0 overflow-x-auto p-6 pt-3'
    : showColumnFilter
      ? 'flex-1 min-h-0 overflow-x-auto px-6 pb-6 pt-3'
      : ''

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={`mf-workspace flex-1 min-h-0 ${workspaceClass}`} style={{ background: 'var(--nm-bg)' }}>
        {title && (
          <header className="mf-negotiations-header shrink-0 flex items-center justify-between gap-4 px-6 py-5" aria-labelledby="negotiations-title">
            <div className="flex items-center gap-3 min-w-0">
              <div className="mf-negotiations-mark size-10 rounded-xl flex items-center justify-center shrink-0" aria-hidden="true">
                <TrendingUp className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="mf-eyebrow mb-1">Pipeline comercial</p>
                <h1 id="negotiations-title" className="text-xl font-bold tracking-tight" style={{ color: 'var(--mf-ink)' }}>{title}</h1>
                {description && <p className="text-xs mt-1" style={{ color: 'var(--mf-muted)' }}>{description}</p>}
              </div>
            </div>
            <span className="mf-negotiations-count shrink-0 text-xs font-semibold tabular-nums">{(columns ?? []).reduce((total, column) => total + column.tasks.length, 0)} negociações</span>
          </header>
        )}
        {showColumnFilter && (
          <div className="shrink-0 px-6 pt-6">
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
              style={{
                background: 'var(--nm-bg)',
                boxShadow: 'inset -3px -3px 7px var(--nm-light), inset 3px 3px 7px var(--nm-dark)',
                border: '1px solid var(--nm-border)',
              }}
            >
              <label className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--nm-text-muted)' }}>
                <ListFilter className="size-4" />
                <span>Coluna</span>
                <select
                  value={selectedColumn?.id ?? ''}
                  onChange={(event) => setSelectedColumnId(event.target.value)}
                  className="h-9 min-w-[220px] rounded-lg px-3 text-sm font-semibold normal-case outline-none"
                  style={{
                    background: 'var(--nm-bg)',
                    color: 'var(--nm-text-primary)',
                    border: '1px solid var(--nm-border)',
                    boxShadow: '-2px -2px 5px var(--nm-light), 2px 2px 5px var(--nm-dark)',
                  }}
                >
                  <option value="">Todas as colunas ({columns?.length ?? 0})</option>
                  {(columns ?? []).map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.title} ({column.tasks.length})
                    </option>
                  ))}
                </select>
              </label>
              {selectedColumn && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedColumnId('')}
                  className="h-9 gap-2 rounded-lg text-xs font-semibold cursor-pointer"
                  style={{ color: 'var(--nm-text-secondary)' }}
                >
                  <X className="size-4" />
                  Limpar
                </Button>
              )}
            </div>
          </div>
        )}
        <div className={boardScrollClass}>
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-5 items-start min-h-[calc(100vh-180px)]">
            {visibleColumns.map((column) => (
              <KanbanColumn key={column.id} column={column} source={source} taskLabel={taskLabel} />
            ))}

            {/* Add column */}
            {!selectedColumn && (isAddingColumn ? (
              <div
                className="w-[320px] shrink-0 p-4 rounded-2xl space-y-3"
                style={{
                  background: 'var(--nm-bg)',
                  boxShadow: '-5px -5px 12px var(--nm-light), 5px 5px 12px var(--nm-dark)',
                  border: '1px solid var(--nm-border)',
                }}
              >
                <Input
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddColumn()
                    if (e.key === 'Escape') { setIsAddingColumn(false); setNewColumnTitle('') }
                  }}
                  placeholder="Nome da coluna..."
                  autoFocus
                  className="rounded-xl text-white placeholder:text-slate-600"
                  style={{
                    background: 'var(--nm-bg)',
                    boxShadow: 'inset -3px -3px 7px var(--nm-light), inset 3px 3px 7px var(--nm-dark)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddColumn} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs cursor-pointer rounded-lg border-0">
                    Criar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsAddingColumn(false); setNewColumnTitle('') }} className="text-slate-500 hover:text-white text-xs cursor-pointer">
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingColumn(true)}
                className="w-[320px] shrink-0 p-4 rounded-2xl cursor-pointer flex items-center justify-center gap-2 text-sm font-medium transition-all duration-200"
                style={{
                  background: 'var(--nm-bg)',
                  boxShadow: 'inset -3px -3px 8px var(--nm-light), inset 3px 3px 8px var(--nm-dark)',
                  border: '1px solid var(--nm-border)',
                  color: 'var(--nm-text-muted)',
                }}
                onMouseEnter={e => {
                  Object.assign((e.currentTarget as HTMLElement).style, {
                    boxShadow: '-5px -5px 12px var(--nm-light), 5px 5px 12px var(--nm-dark)',
                    color: 'var(--nm-text-secondary)',
                  })
                }}
                onMouseLeave={e => {
                  Object.assign((e.currentTarget as HTMLElement).style, {
                    boxShadow: 'inset -3px -3px 8px var(--nm-light), inset 3px 3px 8px var(--nm-dark)',
                    color: 'var(--nm-text-muted)',
                  })
                }}
              >
                <Plus className="w-4 h-4" />
                Nova coluna
              </button>
            ))}
          </div>
          </SortableContext>
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="w-[290px] opacity-90">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>

      {source === 'kanban' && pendingChurn && (
        <ChurnReasonModal
          clientName={pendingChurn.taskTitle}
          onConfirm={confirmChurn}
          onCancel={cancelChurn}
          isSaving={isSavingChurn}
        />
      )}
    </DndContext>
  )
}
