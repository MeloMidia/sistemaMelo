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
import { MentoriaColumn } from './mentoria-column'
import { MentoriaTaskCard } from './mentoria-task-card'
import type { Task, Column } from '@/types'
import { Plus, Loader2, ListFilter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useQueryClient } from '@tanstack/react-query'
import { useChurnDragHandler } from '@/hooks/use-churn-drag'
import { ChurnReasonModal } from '@/components/clientes/churn-reason-modal'

const SOURCE = 'mentoria'

export function MentoriaBoard() {
  const { data: columns, isLoading } = useColumns(SOURCE)
  const createColumn = useCreateColumn(SOURCE)
  const reorderTasks = useReorderTasks()
  const reorderColumns = useReorderColumns()
  const queryClient = useQueryClient()
  const { pendingChurn, interceptDragEnd, confirmChurn, cancelChurn, isSaving: isSavingChurn } = useChurnDragHandler(SOURCE)

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
  const showColumnFilter = (columns?.length ?? 0) > 1

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
    if (!over || !columns) return

    const activeData = active.data.current
    const overData = over.data.current

    if (activeData?.type !== 'task') return

    const activeTask = activeData.task as Task
    let targetColumnId: string | null = null

    if (overData?.type === 'task') {
      const overTask = overData.task as Task
      if (activeTask.columnId !== overTask.columnId) {
        targetColumnId = overTask.columnId
      }
    } else if (overData?.type === 'column') {
      targetColumnId = overData.column.id
    } else if (over.id.toString().startsWith('column-droppable-')) {
      targetColumnId = over.id.toString().replace('column-droppable-', '')
    }

    if (targetColumnId && targetColumnId !== activeTask.columnId) {
      queryClient.setQueryData<Column[]>(['columns', SOURCE], (old) => {
        if (!old) return old
        return old.map((col) => {
          if (col.id === activeTask.columnId) {
            return { ...col, tasks: col.tasks.filter((t) => t.id !== activeTask.id) }
          }
          if (col.id === targetColumnId) {
            return { ...col, tasks: [...col.tasks, { ...activeTask, columnId: targetColumnId! }] }
          }
          return col
        })
      })
    }
  }, [columns, queryClient])

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

          queryClient.setQueryData<Column[]>(['columns', SOURCE], reordered)
          reorderColumns.mutate(items)
        }
      }
      return
    }

    if (activeData?.type === 'task') {
      if (interceptDragEnd(activeTask, active.id as string)) return

      const currentColumns = queryClient.getQueryData<Column[]>(['columns', SOURCE])
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
  }, [columns, queryClient, reorderTasks, reorderColumns, activeTask, interceptDragEnd])

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
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <span className="text-sm text-slate-500">Carregando mentoria...</span>
        </div>
      </div>
    )
  }

  const columnIds = visibleColumns.map((c) => `column-${c.id}`)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="mf-workspace flex-1 min-h-0 flex flex-col overflow-hidden" style={{ background: 'var(--nm-bg)' }}>
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
        <div className="flex-1 min-h-0 overflow-x-auto px-6 pb-6 pt-3">
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-5 items-start min-h-[calc(100vh-180px)]">
            {visibleColumns.map((column) => (
              <MentoriaColumn key={column.id} column={column} />
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
                  className="rounded-xl"
                  style={{
                    background: 'var(--nm-bg)',
                    boxShadow: 'inset -3px -3px 7px var(--nm-light), inset 3px 3px 7px var(--nm-dark)',
                    border: '1px solid var(--nm-border)',
                    color: 'var(--nm-text-primary)',
                  }}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddColumn} className="bg-purple-600 hover:bg-purple-500 text-white text-xs cursor-pointer rounded-lg border-0">
                    Criar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsAddingColumn(false); setNewColumnTitle('') }} className="text-xs cursor-pointer" style={{ color: 'var(--nm-text-muted)' }}>
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
            <MentoriaTaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>

      {pendingChurn && (
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
