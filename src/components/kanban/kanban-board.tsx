'use client'

import { useState, useCallback } from 'react'
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
import { Plus, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useQueryClient } from '@tanstack/react-query'

export function KanbanBoard() {
  const { data: columns, isLoading } = useColumns()
  const createColumn = useCreateColumn()
  const reorderTasks = useReorderTasks()
  const reorderColumns = useReorderColumns()
  const queryClient = useQueryClient()

  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [isAddingColumn, setIsAddingColumn] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')

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
    const currentColumns = queryClient.getQueryData<Column[]>(['columns'])
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
    let targetColumnId: string | null = null

    if (overData?.type === 'task') {
      // Find the over-task's current column from cache (also stale in overData)
      const overTaskId = over.id as string
      for (const col of currentColumns) {
        if (col.tasks.some(t => t.id === overTaskId)) {
          if (col.id !== activeColumnId) targetColumnId = col.id
          break
        }
      }
    } else if (overData?.type === 'column') {
      const colId = overData.column.id as string
      if (colId !== activeColumnId) targetColumnId = colId
    } else if (over.id.toString().startsWith('column-droppable-')) {
      const colId = over.id.toString().replace('column-droppable-', '')
      if (colId !== activeColumnId) targetColumnId = colId
    }

    if (targetColumnId) {
      queryClient.setQueryData<Column[]>(['columns'], (old) => {
        if (!old) return old
        return old.map((col) => {
          if (col.id === activeColumnId) {
            return { ...col, tasks: col.tasks.filter(t => t.id !== activeTaskId) }
          }
          if (col.id === targetColumnId) {
            return { ...col, tasks: [...col.tasks, { ...activeTaskData!, columnId: targetColumnId! }] }
          }
          return col
        })
      })
    }
  }, [queryClient])

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

          queryClient.setQueryData<Column[]>(['columns'], reordered)
          reorderColumns.mutate(items)
        }
      }
      return
    }

    if (activeData?.type === 'task') {
      const currentColumns = queryClient.getQueryData<Column[]>(['columns'])
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
  }, [columns, queryClient, reorderTasks, reorderColumns])

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

  const columnIds = (columns || []).map((c) => `column-${c.id}`)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-x-auto p-6">
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-5 items-start min-h-[calc(100vh-180px)]">
            {(columns || []).map((column) => (
              <KanbanColumn key={column.id} column={column} />
            ))}

            {/* Add column */}
            {isAddingColumn ? (
              <div className="w-[330px] shrink-0 p-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] space-y-3">
                <Input
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddColumn()
                    if (e.key === 'Escape') { setIsAddingColumn(false); setNewColumnTitle('') }
                  }}
                  placeholder="Nome da coluna..."
                  autoFocus
                  className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 rounded-xl"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddColumn} className="bg-blue-600 hover:bg-blue-500 text-white text-xs cursor-pointer rounded-lg">
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
                className="w-[330px] shrink-0 p-4 rounded-2xl border-2 border-dashed border-white/[0.06] text-slate-500 hover:text-white hover:border-blue-500/30 hover:bg-blue-500/[0.03] cursor-pointer flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Plus className="w-5 h-5" />
                Nova coluna
              </button>
            )}
          </div>
        </SortableContext>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="w-[290px] opacity-90">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
