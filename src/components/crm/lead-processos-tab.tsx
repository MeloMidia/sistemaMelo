'use client'

import { useState } from 'react'
import { useLeadTasks, useCreateTask, useUpdateTask, useDeleteTask, useColumns } from '@/hooks/api'
import { Input } from '@/components/ui/input'
import type { Task } from '@/types'
import {
  Plus,
  Calendar,
  Star,
  Trash2,
  Loader2,
  CheckCircle2,
  Check,
  Pencil,
  X,
  Save,
  Clock,
  ClipboardList,
  Activity,
} from 'lucide-react'

const ASSIGNEES = ['Eduardo', 'Gustavo', 'Henrique', 'Lucas', 'Matheus', 'Higor']

function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate() + 1).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface LeadProcessosTabProps {
  leadId: string
}

export function LeadProcessosTab({ leadId }: LeadProcessosTabProps) {
  const { data: tasks, isLoading } = useLeadTasks(leadId)
  const { data: columns } = useColumns()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [assignee, setAssignee] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [completeModal, setCompleteModal] = useState<{ isOpen: boolean; task: Task | null }>({ isOpen: false, task: null })
  const [completedBy, setCompletedBy] = useState('')
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null })

  const defaultColumnId = columns?.[0]?.id || ''

  const activeTasks = tasks?.filter(t => !t.completedAt) ?? []
  const completedTasks = tasks?.filter(t => t.completedAt) ?? []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !defaultColumnId) return

    createTask.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate ? parseDateLocal(dueDate).toISOString() : undefined,
      columnId: defaultColumnId,
      source: 'tasks',
      assignee: assignee || null,
      leadId,
    })

    setTitle('')
    setDescription('')
    setDueDate('')
    setAssignee('')
    setShowForm(false)
  }

  const confirmComplete = () => {
    if (completeModal.task) {
      updateTask.mutate({
        id: completeModal.task.id,
        completedAt: new Date().toISOString(),
        completedBy: completedBy.trim() || undefined,
      })
      setCompleteModal({ isOpen: false, task: null })
    }
  }

  const confirmDelete = () => {
    if (deleteModal.id) {
      deleteTask.mutate(deleteModal.id)
      setDeleteModal({ isOpen: false, id: null })
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Botão / Form de criação */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-white">Nova Tarefa</span>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome da tarefa *"
            required
            autoFocus
            className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 rounded-lg h-9 text-sm"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição opcional..."
            rows={2}
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-slate-600 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30 resize-none"
          />

          <div className="flex gap-2">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-white/[0.04] border-white/[0.1] text-white [color-scheme:dark] rounded-lg h-8 text-xs flex-1"
            />
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="flex-1 h-8 rounded-lg bg-white/[0.04] border border-white/[0.1] text-white text-xs px-2 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
            >
              <option value="">Responsável</option>
              {ASSIGNEES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <button
            type="submit"
            disabled={createTask.isPending || !title.trim() || !defaultColumnId}
            className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {createTask.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Criar Tarefa
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-dashed border-white/[0.12] text-slate-500 hover:text-white hover:border-white/[0.25] hover:bg-white/[0.03] text-sm font-medium transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova Tarefa
        </button>
      )}

      {/* Tarefas ativas */}
      {activeTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-0.5">
            Pendentes ({activeTasks.length})
          </p>
          {activeTasks.map(task => (
            <ProcessoTaskItem
              key={task.id}
              task={task}
              onComplete={() => { setCompleteModal({ isOpen: true, task }); setCompletedBy(task.assignee || '') }}
              onDelete={() => setDeleteModal({ isOpen: true, id: task.id })}
              onEdit={(data) => updateTask.mutate({ id: task.id, ...data })}
              onTogglePriority={() => updateTask.mutate({ id: task.id, isPriorityToday: !task.isPriorityToday })}
              onToggleWaiting={() => updateTask.mutate({ id: task.id, isWaiting: !task.isWaiting })}
            />
          ))}
        </div>
      )}

      {/* Tarefas concluídas */}
      {completedTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-0.5">
            Concluídas ({completedTasks.length})
          </p>
          {completedTasks.map(task => (
            <div key={task.id} className="p-3 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03]">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-400 line-through decoration-slate-600 truncate">{task.title}</p>
                  {task.completedAt && (
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      {new Date(task.completedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {task.completedBy && ` · ${task.completedBy}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && activeTasks.length === 0 && completedTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-600">
          <ClipboardList className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm font-medium">Nenhuma tarefa ainda</p>
          <p className="text-xs mt-0.5">Clique em "Nova Tarefa" para começar</p>
        </div>
      )}

      {/* Modal Concluir */}
      {completeModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCompleteModal({ isOpen: false, task: null })} />
          <div className="relative z-10 w-full max-w-sm bg-[#0f1117] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Concluir Tarefa</h3>
            <p className="text-sm text-slate-400 mb-4">Quem está confirmando a conclusão?</p>
            <Input
              autoFocus
              value={completedBy}
              onChange={(e) => setCompletedBy(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmComplete() }}
              placeholder="Nome da pessoa"
              className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 rounded-xl h-11 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCompleteModal({ isOpen: false, task: null })} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={confirmComplete} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Excluir */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false, id: null })} />
          <div className="relative z-10 w-full max-w-sm bg-[#0f1117] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Excluir Tarefa</h3>
            <p className="text-sm text-slate-400 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModal({ isOpen: false, id: null })} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-500 transition-colors cursor-pointer">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProcessoTaskItem({
  task,
  onComplete,
  onDelete,
  onEdit,
  onTogglePriority,
  onToggleWaiting,
}: {
  task: Task
  onComplete: () => void
  onDelete: () => void
  onEdit: (data: { title: string; description?: string; dueDate?: string; assignee?: string | null }) => void
  onTogglePriority: () => void
  onToggleWaiting: () => void
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
      <div className="p-3 rounded-xl border border-white/[0.15] bg-white/[0.04] space-y-2.5">
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Nome da tarefa..."
          className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 rounded-lg h-8 text-sm"
        />
        <textarea
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          placeholder="Descrição..."
          rows={2}
          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-slate-600 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30 resize-none"
        />
        <div className="flex gap-2">
          <Input
            type="date"
            value={editDue}
            onChange={(e) => setEditDue(e.target.value)}
            className="bg-white/[0.04] border-white/[0.1] text-white [color-scheme:dark] rounded-lg h-8 text-xs flex-1"
          />
          <select
            value={editAssignee}
            onChange={(e) => setEditAssignee(e.target.value)}
            className="flex-1 h-8 rounded-lg bg-white/[0.04] border border-white/[0.1] text-white text-xs px-2 focus:outline-none"
          >
            <option value="">Nenhum</option>
            {ASSIGNEES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={saveEdit}
            disabled={!editTitle.trim()}
            className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
          >
            <Save className="w-3 h-3" /> Salvar
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex items-center justify-center gap-1 px-3 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 text-xs transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group p-3 rounded-xl border border-white/[0.07] hover:border-white/[0.14] bg-black/30 backdrop-blur-sm transition-colors">
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug">{task.title}</p>
          {task.description && (
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {dueDate && (
              <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isOverdue ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.06] text-slate-400'}`}>
                <Calendar className="w-2.5 h-2.5" />
                {dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </span>
            )}
            {task.isPriorityToday && (
              <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                <Star className="w-2.5 h-2.5 fill-current" /> Prioridade
              </span>
            )}
            {task.isDoing && (
              <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                <Activity className="w-2.5 h-2.5" /> Em andamento
              </span>
            )}
            {task.isWaiting && (
              <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400">
                <Clock className="w-2.5 h-2.5" /> Aguardando
              </span>
            )}
            {task.assignee && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                {task.assignee}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity">
          <button
            onClick={onComplete}
            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
            title="Concluir"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={openEdit}
            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onTogglePriority}
            className={`p-1.5 rounded-lg cursor-pointer ${task.isPriorityToday ? 'text-amber-400 hover:bg-amber-500/10' : 'text-slate-600 hover:text-amber-400 hover:bg-amber-500/10'}`}
            title="Prioridade"
          >
            <Star className={`w-3.5 h-3.5 ${task.isPriorityToday ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
            title="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
