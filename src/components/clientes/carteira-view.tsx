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
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useColumns, useUpdateTask } from '@/hooks/api'
import type { Task } from '@/types'
import { Loader2, Users } from 'lucide-react'
import { isChurnColumnTitle } from '@/lib/clientes'

// ── Responsáveis ──────────────────────────────────────────────────────────────

const RESPONSAVEIS = [
  { id: 'Matheus',  color: '#6366f1', bg: '#6366f115', border: '#6366f125' },
  { id: 'Gustavo',  color: '#8b5cf6', bg: '#8b5cf615', border: '#8b5cf625' },
  { id: 'Henrique', color: '#3b82f6', bg: '#3b82f615', border: '#3b82f625' },
] as const

type ResponsavelId = 'Matheus' | 'Gustavo' | 'Henrique'

// ── Card draggável ────────────────────────────────────────────────────────────

function ClientCard({ task, isDragging = false }: { task: Task; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'var(--nm-bg)',
        boxShadow: isDragging
          ? 'inset -3px -3px 7px var(--nm-light), inset 3px 3px 7px var(--nm-dark)'
          : '-3px -3px 8px var(--nm-light), 3px 3px 8px var(--nm-dark)',
        border: '1px solid var(--nm-border)',
        opacity: isDragging ? 0.45 : 1,
        transition: 'box-shadow 0.18s ease, transform 0.15s ease',
      }}
      {...listeners}
      {...attributes}
      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl select-none cursor-grab active:cursor-grabbing touch-none nm-card-hover"
    >
      {/* Avatar inicial */}
      <div className="w-9 h-9 rounded-xl bg-white/[0.07] ring-1 ring-white/[0.10] flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-slate-300">
          {task.title.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Nome */}
      <span className="text-sm text-white font-semibold truncate flex-1 leading-tight">
        {task.title}
      </span>
    </div>
  )
}

// Versão estática do card (usado no DragOverlay)
function ClientCardStatic({ task }: { task: Task }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl rotate-1 scale-105"
      style={{
        background: 'var(--nm-bg)',
        boxShadow: '-8px -8px 18px var(--nm-light), 8px 8px 18px var(--nm-dark)',
        border: '1px solid rgba(99,102,241,0.35)',
      }}
    >
      <div className="w-9 h-9 rounded-xl bg-white/[0.10] flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-slate-200">
          {task.title.charAt(0).toUpperCase()}
        </span>
      </div>
      <span className="text-sm text-white font-semibold truncate">{task.title}</span>
    </div>
  )
}

// ── Coluna droppável ──────────────────────────────────────────────────────────

function ColResponsavel({
  responsavel,
  tasks,
  activeId,
}: {
  responsavel: typeof RESPONSAVEIS[number]
  tasks: Task[]
  activeId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: responsavel.id })

  return (
    <div
      ref={setNodeRef}
      className="rounded-2xl flex flex-col overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--nm-bg)',
        boxShadow: isOver
          ? `-8px -8px 18px var(--nm-light), 8px 8px 18px var(--nm-dark), 0 0 0 2px ${responsavel.color}50`
          : '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
        border: `1px solid ${isOver ? responsavel.color + '50' : 'var(--nm-border)'}`,
        transform: isOver ? 'scale(1.01)' : undefined,
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3.5 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--nm-border)' }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
          style={{ backgroundColor: responsavel.bg, color: responsavel.color }}
        >
          {responsavel.id.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{responsavel.id}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">responsável</p>
        </div>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: responsavel.bg, color: responsavel.color }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto min-h-[120px] max-h-[calc(100vh-240px)]">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="w-5 h-5 text-slate-700 mb-2" />
            <p className="text-xs text-slate-700">Arraste um cliente aqui</p>
          </div>
        ) : (
          tasks.map((task) => (
            <ClientCard key={task.id} task={task} isDragging={task.id === activeId} />
          ))
        )}
      </div>
    </div>
  )
}

// ── Coluna "Sem responsável" ──────────────────────────────────────────────────

function ColSemResponsavel({ tasks, activeId }: { tasks: Task[]; activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'sem-responsavel' })

  return (
    <div
      ref={setNodeRef}
      className="rounded-2xl flex flex-col overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--nm-bg)',
        boxShadow: isOver
          ? 'inset -4px -4px 10px var(--nm-light), inset 4px 4px 10px var(--nm-dark)'
          : '-4px -4px 12px var(--nm-light), 4px 4px 12px var(--nm-dark)',
        border: '1px solid var(--nm-border)',
      }}
    >
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--nm-border)' }}>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sem responsável</span>
        <span className="ml-auto text-xs text-slate-600 bg-white/[0.04] px-2 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <div className="flex-1 p-3 overflow-y-auto max-h-80">
        {tasks.length === 0 ? (
          <p className="text-xs text-slate-700 text-center py-6">Todos atribuídos 🎉</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {tasks.map((task) => (
              <ClientCard key={task.id} task={task} isDragging={task.id === activeId} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── View principal ────────────────────────────────────────────────────────────

export function CarteiraView() {
  const { data: columns, isLoading } = useColumns('kanban')
  const updateTask = useUpdateTask()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const allTasks: Task[] = columns
    ? columns
        .filter((col) => !isChurnColumnTitle(col.title))
        .flatMap((col) => col.tasks)
        .filter((t) => !t.churnedAt)
    : []

  const getTasksByResponsavel = useCallback(
    (id: ResponsavelId | null) => allTasks.filter((t) => t.assignee === id),
    [allTasks]
  )

  const activeTask = activeId ? allTasks.find((t) => t.id === activeId) ?? null : null

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id))
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return

    const taskId = String(active.id)
    const target = String(over.id) // 'Matheus' | 'Gustavo' | 'Henrique' | 'sem-responsavel'
    const newAssignee = target === 'sem-responsavel' ? null : target

    const task = allTasks.find((t) => t.id === taskId)
    if (!task || task.assignee === newAssignee) return

    updateTask.mutate({ id: taskId, assignee: newAssignee })
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
      </div>
    )
  }

  const semResponsavel = getTasksByResponsavel(null)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="mf-workspace flex-1 p-6 overflow-y-auto space-y-5" style={{ background: 'var(--nm-bg)' }}>
        {/* Header */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base font-semibold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
              Carteira
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {allTasks.length} clientes do Processos · arraste para atribuir um responsável
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {RESPONSAVEIS.map((r) => {
              const count = getTasksByResponsavel(r.id as ResponsavelId).length
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: r.bg, color: r.color, border: `1px solid ${r.border}` }}
                >
                  {r.id.charAt(0)} · {count}
                </div>
              )
            })}
          </div>
        </div>

        {/* 3 colunas responsáveis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {RESPONSAVEIS.map((r) => (
            <ColResponsavel
              key={r.id}
              responsavel={r}
              tasks={getTasksByResponsavel(r.id as ResponsavelId)}
              activeId={activeId}
            />
          ))}
        </div>

        {/* Sem responsável */}
        {(semResponsavel.length > 0 || allTasks.length === 0) && (
          <ColSemResponsavel tasks={semResponsavel} activeId={activeId} />
        )}
      </div>

      {/* Ghost card sendo arrastado */}
      <DragOverlay dropAnimation={null}>
        {activeTask ? <ClientCardStatic task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
