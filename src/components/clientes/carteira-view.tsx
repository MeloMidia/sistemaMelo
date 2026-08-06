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
import { GripVertical, Loader2, Users } from 'lucide-react'

// ── Responsáveis ──────────────────────────────────────────────────────────────

const RESPONSAVEIS = [
  { id: 'Matheus',  color: '#6366f1', bg: '#6366f115', border: '#6366f125' },
  { id: 'Gustavo',  color: '#8b5cf6', bg: '#8b5cf615', border: '#8b5cf625' },
  { id: 'Henrique', color: '#3b82f6', bg: '#3b82f615', border: '#3b82f625' },
] as const

type ResponsavelId = 'Matheus' | 'Gustavo' | 'Henrique'

const COLUNAS_EXCLUIDAS = ['encerrado', 'cancelado', 'inativo', 'churned']

// ── Card draggável ────────────────────────────────────────────────────────────

function ClientCard({ task, isDragging = false }: { task: Task; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-150 select-none
        ${isDragging
          ? 'opacity-40 border-white/[0.08] bg-white/[0.03]'
          : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12]'
        }`}
    >
      {/* Drag handle */}
      <span
        {...listeners}
        {...attributes}
        className="shrink-0 cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-500 transition-colors touch-none"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>

      {/* Avatar inicial */}
      <div className="w-6 h-6 rounded-md bg-white/[0.06] ring-1 ring-white/[0.08] flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-slate-400">
          {task.title.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Nome */}
      <span className="text-sm text-white font-medium truncate flex-1">{task.title}</span>
    </div>
  )
}

// Versão estática do card (usado no DragOverlay)
function ClientCardStatic({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/[0.15] bg-[#0d0f1a] shadow-2xl shadow-black/50 rotate-1 scale-105">
      <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      <div className="w-6 h-6 rounded-md bg-white/[0.08] flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-slate-300">
          {task.title.charAt(0).toUpperCase()}
        </span>
      </div>
      <span className="text-sm text-white font-medium truncate">{task.title}</span>
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
      className={`rounded-2xl border flex flex-col overflow-hidden transition-all duration-200 ${
        isOver ? 'ring-2 scale-[1.01]' : ''
      }`}
      style={{
        backgroundColor: '#0a0c14',
        borderColor: isOver ? responsavel.color : responsavel.border,
        boxShadow: isOver ? `0 0 24px ${responsavel.color}20` : undefined,
        // @ts-expect-error css variable
        '--ring-color': responsavel.color,
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3.5 border-b flex items-center gap-3"
        style={{ borderColor: responsavel.border }}
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
      <div className="flex-1 p-3 space-y-1.5 overflow-y-auto min-h-[120px] max-h-[calc(100vh-240px)]">
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
      className={`rounded-2xl border border-white/[0.06] flex flex-col overflow-hidden transition-all duration-200 ${
        isOver ? 'border-white/20 ring-1 ring-white/20' : ''
      }`}
      style={{ backgroundColor: '#0a0c14' }}
    >
      <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sem responsável</span>
        <span className="ml-auto text-xs text-slate-600 bg-white/[0.04] px-2 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <div className="flex-1 p-3 overflow-y-auto max-h-64">
        {tasks.length === 0 ? (
          <p className="text-xs text-slate-700 text-center py-6">Todos atribuídos 🎉</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
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
        .filter((col) => !COLUNAS_EXCLUIDAS.some((ex) => col.title.toLowerCase().includes(ex)))
        .flatMap((col) => col.tasks)
        .filter((t) => !t.completedAt)
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
      <div className="flex-1 p-6 overflow-y-auto space-y-5">
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
