'use client'

import { useState, useMemo, useCallback } from 'react'
import { useAllTasks, useCreateTask, useUpdateTask, useDeleteTask, useColumns, useCompletedTasks } from '@/hooks/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { Task } from '@/types'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import {
  Plus,
  Calendar,
  Star,
  Trash2,
  Loader2,
  ClipboardList,
  Flame,
  CheckCircle2,
  History,
  ChevronDown,
  ChevronUp,
  Check,
  Pencil,
  X,
  Save,
  Activity,
  Clock,
} from 'lucide-react'

// Converte string "YYYY-MM-DD" para Date sem perder um dia por timezone
function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

// Converte Date para string "YYYY-MM-DD" para preencher input[type=date]
function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate() + 1).padStart(2, '0') // +1 compensa o UTC shift na leitura
  return `${y}-${m}-${day}`
}

const ASSIGNEES = ['Eduardo', 'Gustavo', 'Henrique', 'Lucas', 'Matheus', 'Higor']

function DroppableColumn({ id, title, icon: Icon, count, tasks, children, emptyMessage, colorClass, borderClass, bgClass, headerClass }: any) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border flex flex-col overflow-hidden transition-colors
        ${isOver ? 'ring-2 ring-blue-500/50' : ''}
        ${borderClass} ${bgClass}`}
    >
      <div className={`p-5 border-b flex items-center justify-between ${headerClass}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2>
            <p className="text-xs font-medium opacity-70">{count} tarefas</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 opacity-50">
            <Icon className="w-10 h-10 mb-2" />
            <p className="text-sm font-medium">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function DraggableTask({ task, children }: { task: Task, children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task }
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-none outline-none">
      <div className={isDragging ? "cursor-grabbing" : "cursor-grab"}>
        {children}
      </div>
    </div>
  )
}

export function TaskManager() {
  const { data: tasks, isLoading: tasksLoading } = useAllTasks()
  const { data: completedTasks, isLoading: historyLoading } = useCompletedTasks()
  const { data: columns } = useColumns()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isPriority, setIsPriority] = useState(false)
  const [assignee, setAssignee] = useState('')
  const [sortBy, setSortBy] = useState<'created' | 'dueDate'>('created')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const [completeModal, setCompleteModal] = useState<{ isOpen: boolean; task: Task | null }>({ isOpen: false, task: null })
  const [completedBy, setCompletedBy] = useState('')
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null })

  const defaultColumnId = columns?.[0]?.id || ''

  // Custom coordinate getter que ignora eventos de teclado vindos de inputs/textareas/selects
  // Isso impede o bug do espaço nos campos de edição
  const customKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
    const tag = (event.target as HTMLElement)?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      return undefined
    }
    return sortableKeyboardCoordinates(event, args)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: customKeyboardCoordinates })
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !defaultColumnId) return

    createTask.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate ? parseDateLocal(dueDate).toISOString() : undefined,
      isPriorityToday: isPriority,
      columnId: defaultColumnId,
      source: 'tasks',
      assignee: assignee || null,
    } as any)

    setTitle('')
    setDescription('')
    setDueDate('')
    setIsPriority(false)
    setAssignee('')
  }

  const allTasks = useMemo(() => {
    if (!tasks) return []
    const sorted = [...tasks]
    if (sortBy === 'dueDate') {
      sorted.sort((a, b) => {
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      })
    } else {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }
    return sorted
  }, [tasks, sortBy])

  const queueTasks = useMemo(() => allTasks.filter(t => !t.isPriorityToday && !t.isDoing), [allTasks])
  const doingTasks = useMemo(() => allTasks.filter(t => t.isDoing && !t.isPriorityToday), [allTasks])
  const priorityTasks = useMemo(() => allTasks.filter(t => t.isPriorityToday), [allTasks])

  const handleDeleteClick = (id: string) => {
    setDeleteModal({ isOpen: true, id })
  }

  const confirmDelete = () => {
    if (deleteModal.id) {
      deleteTask.mutate(deleteModal.id)
      setDeleteModal({ isOpen: false, id: null })
    }
  }

  const handleCompleteClick = (task: Task) => {
    setCompleteModal({ isOpen: true, task })
    setCompletedBy(task.assignee || '')
  }

  const confirmComplete = () => {
    if (completeModal.task) {
      updateTask.mutate({
        id: completeModal.task.id,
        completedAt: new Date().toISOString(),
        completedBy: completedBy.trim() || undefined
      })
      setCompleteModal({ isOpen: false, task: null })
      setHistoryOpen(true)
    }
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    if (active.data.current?.task) {
      setActiveTask(active.data.current.task as Task)
    }
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const activeTask = active.data.current?.task as Task
    if (!activeTask) return

    const overId = over.id.toString()

    let updates: Partial<Task> = {}
    if (overId === 'col-queue') {
      updates = { isDoing: false, isPriorityToday: false }
    } else if (overId === 'col-doing') {
      updates = { isDoing: true, isPriorityToday: false }
    } else if (overId === 'col-priority') {
      updates = { isDoing: false, isPriorityToday: true }
    }

    if (activeTask.isDoing !== updates.isDoing || activeTask.isPriorityToday !== updates.isPriorityToday) {
      updateTask.mutate({ id: activeTask.id, ...updates })
    }
  }, [updateTask])

  if (tasksLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="text-sm text-slate-500">Carregando tarefas...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* 4-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[500px]">
          {/* Column 1: Form */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center ring-1 ring-blue-500/20">
                <Plus className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-heading)' }}>Nova Tarefa</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="taskTitle" className="text-slate-300 text-sm font-medium">
                  Nome da tarefa *
                </Label>
                <Input
                  id="taskTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Digite o nome..."
                  required
                  className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 rounded-xl h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taskDesc" className="text-slate-300 text-sm font-medium">
                  Descrição
                </Label>
                <textarea
                  id="taskDesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição opcional..."
                  rows={3}
                  className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-slate-600 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taskDue" className="text-slate-300 text-sm font-medium">
                  Data máxima de entrega
                </Label>
                <Input
                  id="taskDue"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-white/[0.04] border-white/[0.1] text-white [color-scheme:dark] rounded-xl h-11"
                />
              </div>

              <Button
                type="submit"
                disabled={createTask.isPending || !title.trim()}
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold border-0 shadow-lg shadow-blue-600/20 cursor-pointer rounded-xl text-[15px]"
              >
                {createTask.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Criar Tarefa
              </Button>
            </form>
          </div>

          {/* Column 2: Task Queue */}
          <DroppableColumn
            id="col-queue"
            title="Fila de Tarefas"
            icon={ClipboardList}
            count={queueTasks.length}
            tasks={queueTasks}
            emptyMessage="Nenhuma tarefa na fila"
            colorClass="bg-gradient-to-br from-indigo-500/20 to-blue-500/10 ring-indigo-500/20 text-indigo-400"
            borderClass="border-white/[0.07]"
            bgClass="bg-white/[0.02]"
            headerClass="border-white/[0.07]"
          >
            {queueTasks.map((task) => (
              <DraggableTask key={task.id} task={task}>
                <TaskQueueItem
                  task={task}
                  onTogglePriority={() => updateTask.mutate({ id: task.id, isPriorityToday: !task.isPriorityToday })}
                  onToggleWaiting={() => updateTask.mutate({ id: task.id, isWaiting: !task.isWaiting })}
                  onDelete={() => handleDeleteClick(task.id)}
                  onComplete={() => handleCompleteClick(task)}
                  onEdit={(data) => updateTask.mutate({ id: task.id, ...data })}
                />
              </DraggableTask>
            ))}
          </DroppableColumn>

          {/* Column 3: Doing */}
          <DroppableColumn
            id="col-doing"
            title="Fazendo"
            icon={Activity}
            count={doingTasks.length}
            tasks={doingTasks}
            emptyMessage="Nenhuma tarefa em andamento"
            colorClass="bg-gradient-to-br from-blue-500/20 to-cyan-500/10 ring-blue-500/20 text-blue-400"
            borderClass="border-blue-500/15"
            bgClass="bg-blue-500/[0.02]"
            headerClass="border-blue-500/15 bg-gradient-to-b from-blue-500/[0.05] to-transparent text-blue-100"
          >
            {doingTasks.map((task) => (
              <DraggableTask key={task.id} task={task}>
                <TaskQueueItem
                  task={task}
                  isDoingView
                  onTogglePriority={() => updateTask.mutate({ id: task.id, isPriorityToday: !task.isPriorityToday })}
                  onToggleWaiting={() => updateTask.mutate({ id: task.id, isWaiting: !task.isWaiting })}
                  onDelete={() => handleDeleteClick(task.id)}
                  onComplete={() => handleCompleteClick(task)}
                  onEdit={(data) => updateTask.mutate({ id: task.id, ...data })}
                />
              </DraggableTask>
            ))}
          </DroppableColumn>

          {/* Column 4: Priority */}
          <DroppableColumn
            id="col-priority"
            title="Tarefa do Dia"
            icon={Star}
            count={priorityTasks.length}
            tasks={priorityTasks}
            emptyMessage="Nenhuma prioridade definida"
            colorClass="bg-gradient-to-br from-amber-500/25 to-amber-500/10 ring-amber-500/25 text-amber-400"
            borderClass="border-amber-500/15"
            bgClass="bg-amber-500/[0.02]"
            headerClass="border-amber-500/15 bg-gradient-to-b from-amber-500/[0.08] to-transparent text-amber-100"
          >
            {priorityTasks.map((task) => (
              <DraggableTask key={task.id} task={task}>
                <TaskQueueItem
                  task={task}
                  isPriorityView
                  onTogglePriority={() => updateTask.mutate({ id: task.id, isPriorityToday: false })}
                  onToggleWaiting={() => updateTask.mutate({ id: task.id, isWaiting: !task.isWaiting })}
                  onDelete={() => handleDeleteClick(task.id)}
                  onComplete={() => handleCompleteClick(task)}
                  onEdit={(data) => updateTask.mutate({ id: task.id, ...data })}
                />
              </DraggableTask>
            ))}
          </DroppableColumn>
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-[300px] opacity-90 rotate-2 scale-105 transition-transform">
              <TaskQueueItem
                task={activeTask}
                isPriorityView={activeTask.isPriorityToday}
                isDoingView={activeTask.isDoing}
                onTogglePriority={() => { }}
                onToggleWaiting={() => { }}
                onDelete={() => { }}
                onComplete={() => { }}
                onEdit={() => { }}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* History Section */}
      <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
              <History className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                Histórico
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Tarefas concluídas nos últimos 30 dias
                {completedTasks && ` · ${completedTasks.length} tarefas`}
              </p>
            </div>
          </div>
          {historyOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {historyOpen && (
          <div className="border-t border-white/[0.07] p-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              </div>
            ) : !completedTasks || completedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                <CheckCircle2 className="w-10 h-10 mb-2" />
                <p className="text-sm font-medium">Nenhuma tarefa concluída nos últimos 30 dias</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {completedTasks.map((task) => (
                  <HistoryItem key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal de Confirmação de Exclusão ──────────────── */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false, id: null })} />
          <div className="relative z-10 w-full max-w-sm bg-[#0f1117] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Excluir Tarefa</h3>
            <p className="text-sm text-slate-400 mb-6">Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ isOpen: false, id: null })}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-500 transition-colors cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Confirmação de Conclusão ──────────────── */}
      {completeModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCompleteModal({ isOpen: false, task: null })} />
          <div className="relative z-10 w-full max-w-sm bg-[#0f1117] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Concluir Tarefa</h3>
            <p className="text-sm text-slate-400 mb-4">Tem certeza que deseja marcar esta tarefa como concluída?</p>

            <div className="mb-6 space-y-2">
              <label className="text-xs font-medium text-slate-300 block">Quem está confirmando?</label>
              <Input
                autoFocus
                value={completedBy}
                onChange={(e) => setCompletedBy(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmComplete()
                }}
                placeholder="Nome da pessoa"
                className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 rounded-xl h-11"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setCompleteModal({ isOpen: false, task: null })}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmComplete}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// TaskQueueItem com modal de edição inline
// ──────────────────────────────────────────────────────────
function TaskQueueItem({
  task,
  isPriorityView,
  isDoingView,
  onTogglePriority,
  onToggleWaiting,
  onDelete,
  onComplete,
  onEdit,
}: {
  task: Task
  isPriorityView?: boolean
  isDoingView?: boolean
  onTogglePriority: () => void
  onToggleWaiting: () => void
  onDelete: () => void
  onComplete: () => void
  onEdit: (data: { title: string; description?: string; dueDate?: string; assignee?: string | null }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDesc, setEditDesc] = useState(task.description || '')
  const [editDue, setEditDue] = useState(toDateInputValue(task.dueDate))
  const [editAssignee, setEditAssignee] = useState(task.assignee || '')

  const dueDate = task.dueDate ? new Date(task.dueDate) : null
  const isOverdue = dueDate && dueDate < new Date()

  const openEdit = () => {
    setEditTitle(task.title)
    setEditDesc(task.description || '')
    setEditDue(toDateInputValue(task.dueDate))
    setEditAssignee(task.assignee || '')
    setEditing(true)
  }

  const saveEdit = () => {
    if (!editTitle.trim()) return
    onEdit({
      title: editTitle.trim(),
      description: editDesc.trim() || undefined,
      dueDate: editDue ? parseDateLocal(editDue).toISOString() : undefined,
      assignee: editAssignee || null,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className={`p-3.5 rounded-xl border space-y-3 cursor-default ${isPriorityView
          ? 'bg-amber-500/[0.07] border-amber-500/20'
          : isDoingView
            ? 'bg-blue-500/[0.07] border-blue-500/20'
            : 'bg-white/[0.05] border-white/[0.2]'
        }`}
        onPointerDown={(e) => e.stopPropagation()} // Impede o drag enquanto edita
      >
        {/* Título */}
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Nome da tarefa..."
          className="bg-white/[0.05] border-white/[0.12] text-white placeholder:text-slate-600 rounded-lg h-9 text-sm"
        />

        {/* Descrição */}
        <textarea
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Descrição..."
          rows={2}
          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-slate-600 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30 resize-none"
        />

        {/* Data + Responsável */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={editDue}
            onChange={(e) => setEditDue(e.target.value)}
            className="bg-white/[0.04] border-white/[0.1] text-white [color-scheme:dark] rounded-lg h-8 text-xs flex-1"
          />
          <select
            value={editAssignee}
            onChange={(e) => setEditAssignee(e.target.value)}
            className="flex-1 h-8 rounded-lg bg-white/[0.04] border border-white/[0.1] text-white text-xs px-2 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          >
            <option value="">Nenhum</option>
            {ASSIGNEES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Botões */}
        <div className="flex gap-2">
          <button
            onClick={saveEdit}
            disabled={!editTitle.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" /> Salvar
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 text-xs font-medium transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`
      group p-3.5 rounded-xl border bg-black/40 backdrop-blur-sm
      ${isPriorityView
        ? 'border-amber-500/20 hover:border-amber-500/40 shadow-[0_4px_12px_rgba(245,158,11,0.05)]'
        : isDoingView
          ? 'border-blue-500/20 hover:border-blue-500/40 shadow-[0_4px_12px_rgba(59,130,246,0.05)]'
          : 'border-white/[0.07] hover:border-white/[0.14] shadow-sm'
      }
    `}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-white leading-snug">{task.title}</p>
          {task.description && (
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed break-words whitespace-pre-wrap">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {dueDate && (
              <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.06] text-slate-400'
                }`}>
                <Calendar className="w-3 h-3" />
                {dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </span>
            )}
            {task.isPriorityToday && !isPriorityView && (
              <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                <Star className="w-3 h-3 fill-current" />
              </span>
            )}
            {task.isDoing && !isDoingView && (
              <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                <Activity className="w-3 h-3" />
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleWaiting() }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors cursor-pointer ${task.isWaiting
                  ? 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25'
                  : 'bg-white/[0.04] text-slate-600 hover:bg-orange-500/10 hover:text-orange-400'
                }`}
              title={task.isWaiting ? 'Remover aguardando' : 'Marcar como aguardando'}
            >
              <Clock className="w-3 h-3" />
              {task.isWaiting && 'Aguardando'}
            </button>
            {task.assignee && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                {task.assignee}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onComplete() }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
            title="Marcar como concluída"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openEdit() }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
            title="Editar tarefa"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePriority() }}
            className={`p-1.5 rounded-lg cursor-pointer ${task.isPriorityToday
                ? 'text-amber-400 hover:bg-amber-500/10'
                : 'text-slate-600 hover:text-amber-400 hover:bg-amber-500/10'
              }`}
            title={task.isPriorityToday ? 'Remover prioridade' : 'Marcar como prioridade'}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Star className={`w-4 h-4 ${task.isPriorityToday ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
            title="Excluir"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryItem({ task }: { task: Task }) {
  const completedAt = task.completedAt ? new Date(task.completedAt) : null
  const dueDate = task.dueDate ? new Date(task.dueDate) : null

  return (
    <div className="p-3.5 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03]">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-300 truncate line-through decoration-slate-600">{task.title}</p>
          {task.description && (
            <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {completedAt && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500/70">
                <Check className="w-3 h-3" />
                {completedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                {task.completedBy && ` · ${task.completedBy}`}
              </span>
            )}
            {dueDate && (
              <span className="flex items-center gap-1 text-[11px] text-slate-600">
                <Calendar className="w-3 h-3" />
                {dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
