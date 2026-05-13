'use client'

import { useState, useMemo } from 'react'
import { useAllTasks, useCreateTask, useUpdateTask, useDeleteTask, useColumns, useCompletedTasks } from '@/hooks/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { Task } from '@/types'
import {
  Plus,
  Calendar,
  Star,
  Trash2,
  ArrowUpDown,
  Loader2,
  ClipboardList,
  Flame,
  FileText,
  CheckCircle2,
  History,
  ChevronDown,
  ChevronUp,
  Check,
  Pencil,
  X,
  Save,
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

  const defaultColumnId = columns?.[0]?.id || ''

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !defaultColumnId) return

    createTask.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      // Envia como ISO mas ajustado para horário local (meio-dia) evitando shift
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

  const queueTasks = useMemo(() => allTasks.filter(t => !t.isPriorityToday), [allTasks])
  const priorityTasks = useMemo(() => allTasks.filter(t => t.isPriorityToday), [allTasks])

  const handleComplete = (task: Task) => {
    updateTask.mutate({ id: task.id, completedAt: new Date().toISOString() })
    setHistoryOpen(true)
  }

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
      {/* 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">
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

            <div className="space-y-2">
              <Label htmlFor="taskAssignee" className="text-slate-300 text-sm font-medium">
                Responsável
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setAssignee('')}
                  className={`h-10 rounded-xl text-xs font-medium border cursor-pointer transition-colors ${
                    assignee === ''
                      ? 'bg-slate-600 border-slate-500 text-white'
                      : 'bg-white/[0.03] border-white/[0.08] text-slate-500 hover:border-white/[0.2] hover:text-slate-300'
                  }`}
                >
                  Nenhum
                </button>
                {ASSIGNEES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setAssignee(name)}
                    className={`h-10 rounded-xl text-xs font-medium border cursor-pointer transition-colors ${
                      assignee === name
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:border-blue-500/40 hover:text-white'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/15">
              <Checkbox
                id="taskPriority"
                checked={isPriority}
                onCheckedChange={(checked) => setIsPriority(checked === true)}
                className="border-amber-500/40 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 cursor-pointer"
              />
              <Label htmlFor="taskPriority" className="text-amber-300 text-sm font-medium cursor-pointer flex items-center gap-2">
                <Flame className="w-4 h-4" />
                Prioridade para hoje
              </Label>
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
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] flex flex-col overflow-hidden">
          <div className="p-5 border-b border-white/[0.07] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/10 flex items-center justify-center ring-1 ring-indigo-500/20">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-heading)' }}>Fila de Tarefas</h2>
                <p className="text-xs text-slate-500 font-medium">{queueTasks.length} tarefas</p>
              </div>
            </div>
            <button
              onClick={() => setSortBy(sortBy === 'created' ? 'dueDate' : 'created')}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-white/[0.06] cursor-pointer font-medium"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {sortBy === 'created' ? 'Por criação' : 'Por data'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {queueTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-600">
                <FileText className="w-10 h-10 mb-2" />
                <p className="text-sm font-medium">Nenhuma tarefa criada</p>
              </div>
            ) : (
              queueTasks.map((task) => (
                <TaskQueueItem
                  key={task.id}
                  task={task}
                  onTogglePriority={() => updateTask.mutate({ id: task.id, isPriorityToday: !task.isPriorityToday })}
                  onDelete={() => deleteTask.mutate(task.id)}
                  onComplete={() => handleComplete(task)}
                  onEdit={(data) => updateTask.mutate({ id: task.id, ...data })}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 3: Priority */}
        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.02] flex flex-col overflow-hidden">
          <div className="p-5 border-b border-amber-500/15 bg-gradient-to-b from-amber-500/[0.08] to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/25 to-amber-500/10 flex items-center justify-center ring-1 ring-amber-500/25">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-amber-100" style={{ fontFamily: 'var(--font-heading)' }}>Prioridade do Dia</h2>
                <p className="text-xs text-amber-400/60 font-medium">{priorityTasks.length} tarefas</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {priorityTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-amber-500/30">
                <Flame className="w-10 h-10 mb-2" />
                <p className="text-sm font-medium">Nenhuma prioridade definida</p>
              </div>
            ) : (
              priorityTasks.map((task) => (
                <TaskQueueItem
                  key={task.id}
                  task={task}
                  isPriorityView
                  onTogglePriority={() => updateTask.mutate({ id: task.id, isPriorityToday: false })}
                  onDelete={() => deleteTask.mutate(task.id)}
                  onComplete={() => handleComplete(task)}
                  onEdit={(data) => updateTask.mutate({ id: task.id, ...data })}
                />
              ))
            )}
          </div>
        </div>
      </div>

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
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// TaskQueueItem com modal de edição inline
// ──────────────────────────────────────────────────────────
function TaskQueueItem({
  task,
  isPriorityView,
  onTogglePriority,
  onDelete,
  onComplete,
  onEdit,
}: {
  task: Task
  isPriorityView?: boolean
  onTogglePriority: () => void
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
      <div className={`p-3.5 rounded-xl border space-y-3 ${
        isPriorityView
          ? 'bg-amber-500/[0.07] border-amber-500/20'
          : 'bg-blue-500/[0.05] border-blue-500/20'
      }`}>
        {/* Título */}
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Nome da tarefa..."
          className="bg-white/[0.05] border-white/[0.12] text-white placeholder:text-slate-600 rounded-lg h-9 text-sm"
        />

        {/* Descrição */}
        <textarea
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
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
      group p-3.5 rounded-xl border
      ${isPriorityView
        ? 'bg-amber-500/[0.04] border-amber-500/10 hover:border-amber-500/25'
        : 'bg-white/[0.02] border-white/[0.07] hover:border-white/[0.14]'
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
              <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                isOverdue ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.06] text-slate-400'
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
            {task.assignee && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                {task.assignee}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0">
          <button
            onClick={onComplete}
            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
            title="Marcar como concluída"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={openEdit}
            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
            title="Editar tarefa"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onTogglePriority}
            className={`p-1.5 rounded-lg cursor-pointer ${
              task.isPriorityToday
                ? 'text-amber-400 hover:bg-amber-500/10'
                : 'text-slate-600 hover:text-amber-400 hover:bg-amber-500/10'
            }`}
            title={task.isPriorityToday ? 'Remover prioridade' : 'Marcar como prioridade'}
          >
            <Star className={`w-4 h-4 ${task.isPriorityToday ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
            title="Excluir"
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
