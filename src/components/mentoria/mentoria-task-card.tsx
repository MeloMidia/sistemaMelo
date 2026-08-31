'use client'

import { useState, useRef, useEffect } from 'react'
import type { Task as TaskType } from '@/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Trash2, Calendar, Star, Pencil, Check, X,
  ImagePlus, Save, Plus, Users, ClipboardList, CheckCircle2, Clock, UserX
} from 'lucide-react'
import { useDeleteTask, useUpdateTask, useCreateTask, useCreateColumn, useKanbanCardTasks, useColumns } from '@/hooks/api'
import { Input } from '@/components/ui/input'
import { ChurnReasonModal } from '@/components/clientes/churn-reason-modal'
import { isChurnColumnTitle, DEFAULT_ENCERRADO_COLUMN_TITLE } from '@/lib/clientes'

interface MentoriaTaskCardProps {
  task: TaskType
}


function toLocalDateString(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateLocal(str: string): string {
  if (!str) return ''
  const [year, month, day] = str.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0).toISOString()
}

function formatDateBR(date: Date | string | null | undefined) {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function MentoriaTaskCard({ task }: MentoriaTaskCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDueDate, setEditDueDate] = useState(toLocalDateString(task.dueDate))
  const [editLogo, setEditLogo] = useState<string | null>(task.logoUrl)
  const [editMeetings, setEditMeetings] = useState(String(task.meetingsCount || 0))
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [churnModalOpen, setChurnModalOpen] = useState(false)
  const [editModalMeetings, setEditModalMeetings] = useState(String(task.meetingsCount || 0))

  // Task creation modal state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [taskDesc, setTaskDesc] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')

  useEffect(() => {
    setEditModalMeetings(String(task.meetingsCount || 0))
  }, [task.meetingsCount])

  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()
  const createTask = useCreateTask()
  const createColumn = useCreateColumn('mentoria')
  const { data: columns } = useColumns('tasks')
  const { data: kanbanColumns } = useColumns()
  const { data: mentoriaColumns } = useColumns('mentoria')
  const { data: cardTasks } = useKanbanCardTasks(task.id)

  const activeTasks = (cardTasks ?? []).filter(t => !t.completedAt)
  const completedCardTasks = (cardTasks ?? []).filter(t => t.completedAt)

  const handleCreateTask = () => {
    const columnId = columns?.[0]?.id ?? kanbanColumns?.[0]?.id
    if (!columnId) return
    const [y, m, d] = (taskDueDate || '').split('-').map(Number)
    createTask.mutate({
      title: task.title,
      description: taskDesc.trim() || undefined,
      dueDate: taskDueDate ? new Date(y, m - 1, d, 12).toISOString() : undefined,
      columnId,
      source: 'tasks',
      kanbanTaskId: task.id,
    }, {
      onSuccess: () => {
        setTaskDesc('')
        setTaskDueDate('')
        setCreateModalOpen(false)
      }
    })
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleSave = () => {
    if (!editTitle.trim()) return
    updateTask.mutate({
      id: task.id,
      title: editTitle.trim(),
      dueDate: editDueDate ? parseDateLocal(editDueDate) : null,
      logoUrl: editLogo,
      meetingsCount: editMeetings ? parseInt(editMeetings, 10) : 0,
    } as any)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditTitle(task.title)
    setEditDueDate(toLocalDateString(task.dueDate))
    setEditLogo(task.logoUrl)
    setEditMeetings(String(task.meetingsCount || 0))
    setIsEditing(false)
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setEditLogo(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleTogglePriority = () => {
    updateTask.mutate({ id: task.id, isPriorityToday: !task.isPriorityToday })
  }

  const handleEncerrarContrato = async (reason: string) => {
    const existing = mentoriaColumns?.find((c) => isChurnColumnTitle(c.title))
    const columnId = existing ? existing.id : (await createColumn.mutateAsync(DEFAULT_ENCERRADO_COLUMN_TITLE)).id
    updateTask.mutate({ id: task.id, columnId, churnedAt: new Date().toISOString(), churnReason: reason })
    setChurnModalOpen(false)
  }

  const handleOpenModal = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('textarea')) return
    if (isEditing) return
    setModalOpen(true)
  }

  const handleSaveMeetingsFromModal = () => {
    const val = parseInt(editModalMeetings, 10)
    if (!isNaN(val) && val !== task.meetingsCount) {
      updateTask.mutate({ id: task.id, meetingsCount: val } as any)
    }
  }

  const dueDate = task.dueDate ? new Date(task.dueDate) : null
  const isOverdue = dueDate && dueDate < new Date()

  const initial = task.title.charAt(0).toUpperCase()
  const monogramStyles = [
    'from-purple-500/20 to-indigo-600/10 text-purple-300 ring-1 ring-purple-500/25',
    'from-fuchsia-500/20 to-pink-600/10 text-fuchsia-300 ring-1 ring-fuchsia-500/25',
    'from-violet-500/20 to-purple-600/10 text-violet-300 ring-1 ring-violet-500/25',
    'from-pink-500/20 to-rose-600/10 text-pink-300 ring-1 ring-pink-500/25',
    'from-rose-500/20 to-purple-600/10 text-rose-300 ring-1 ring-rose-500/25',
    'from-indigo-500/20 to-blue-600/10 text-indigo-300 ring-1 ring-indigo-500/25',
  ]
  const colorIdx = Math.abs(task.title.charCodeAt(0)) % monogramStyles.length
  const placeholderStyle = monogramStyles[colorIdx]

  return (
    <>
      {/* ── Card ─────────────────────────────────────── */}
      <div
        ref={setNodeRef}
        onClick={handleOpenModal}
        style={{
          ...style,
          background: 'var(--nm-bg)',
          boxShadow: isDragging
            ? 'inset -3px -3px 8px var(--nm-light), inset 3px 3px 8px var(--nm-dark)'
            : '-3px -3px 8px var(--nm-light), 3px 3px 8px var(--nm-dark)',
          border: task.isPriorityToday && !isDragging
            ? '1px solid rgba(245,158,11,0.35)'
            : '1px solid var(--nm-border)',
          borderLeft: task.isPriorityToday && !isDragging
            ? '2px solid rgba(245,158,11,0.6)'
            : undefined,
          opacity: isDragging ? 0.45 : 1,
          transition: 'box-shadow 0.18s ease, transform 0.15s ease',
        }}
        className={`group relative p-3.5 rounded-xl nm-card-hover ${!isEditing ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-start gap-2.5">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 p-0.5 rounded text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing shrink-0 hover:bg-white/[0.04] transition-colors"
            aria-label="Arrastar mentoria"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2.5" onClick={(e) => e.stopPropagation()}>
                {/* Logo edit */}
                <div className="flex items-center gap-3">
                  {editLogo ? (
                    <img src={editLogo} alt="logo" className="w-10 h-10 rounded-xl object-cover border border-white/[0.15] shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-center shrink-0">
                      <ImagePlus className="w-4 h-4 text-slate-600" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.2] cursor-pointer transition-colors"
                  >
                    {editLogo ? 'Trocar logo' : 'Adicionar logo'}
                  </button>
                  {editLogo && (
                    <button type="button" onClick={() => setEditLogo(null)} className="text-xs text-red-400/70 hover:text-red-400 cursor-pointer">
                      Remover
                    </button>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </div>

                {/* Title edit */}
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave()
                    if (e.key === 'Escape') handleCancel()
                  }}
                  placeholder="Nome do cliente..."
                  autoFocus
                  className="h-8 text-sm bg-white/[0.04] border-white/[0.12] text-white rounded-lg focus-visible:ring-1 focus-visible:ring-white/20"
                />

                {/* Due date edit */}
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Encerramento do contrato</label>
                  <Input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="h-8 text-sm bg-white/[0.04] border-white/[0.12] text-white [color-scheme:dark] rounded-lg"
                  />
                </div>

                {/* Meetings count edit */}
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Quantidade de reuniões feitas</label>
                  <Input
                    type="number"
                    min="0"
                    value={editMeetings}
                    onChange={(e) => setEditMeetings(e.target.value)}
                    className="h-8 text-sm bg-white/[0.04] border-white/[0.12] text-white rounded-lg"
                  />
                </div>

                {/* Save / Cancel */}
                <div className="flex gap-2 pt-0.5">
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" /> Salvar
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Logo + title */}
                <div className="flex items-center gap-3 min-w-0">
                  {task.logoUrl ? (
                    <img
                      src={task.logoUrl}
                      alt={`${task.title} logo`}
                      className="w-9 h-9 rounded-xl object-cover border border-white/[0.08] shrink-0"
                    />
                  ) : (
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 bg-gradient-to-br ${placeholderStyle}`}>
                      {initial}
                    </div>
                  )}
                  <p className="text-sm font-semibold text-white leading-snug tracking-tight">
                    {task.title}
                  </p>
                </div>

                {task.description && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{task.description}</p>
                )}

                {/* Meta details / Badges row */}
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  {dueDate && (
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                      isOverdue
                        ? 'bg-red-500/10 text-red-400 border-red-500/15'
                        : 'bg-white/[0.04] text-slate-400 border-white/[0.03]'
                    }`}>
                      <Calendar className="w-3 h-3 shrink-0" />
                      Enc. {formatDateBR(dueDate)}
                    </span>
                  )}
                  {task.isPriorityToday && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/15">
                      <Star className="w-3 h-3 fill-current shrink-0" />
                      Prioridade
                    </span>
                  )}
                  {(task.meetingsCount > 0) && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/15">
                      <Users className="w-3 h-3 shrink-0" />
                      {task.meetingsCount} Reuni{task.meetingsCount !== 1 ? 'ões' : 'ão'}
                    </span>
                  )}
                  {activeTasks.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/15">
                      <ClipboardList className="w-3 h-3 shrink-0" />
                      {activeTasks.length} {activeTasks.length === 1 ? 'tarefa' : 'tarefas'}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          {!isEditing && (
            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity duration-200" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleTogglePriority}
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  task.isPriorityToday
                    ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                    : 'text-slate-600 hover:text-amber-400 hover:bg-amber-500/10'
                }`}
                title="Prioridade do dia"
              >
                <Star className={`w-3.5 h-3.5 ${task.isPriorityToday ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors"
                title="Editar"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setChurnModalOpen(true)
                }}
                className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                title="Encerrar contrato"
              >
                <UserX className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteModalOpen(true)
                }}
                className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                title="Excluir cadastro (definitivo)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de detalhes do cliente ──────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <div
            className="relative z-10 w-full max-w-lg rounded-2xl overflow-hidden"
            style={{
              background: 'var(--nm-bg)',
              boxShadow: '-12px -12px 28px var(--nm-light), 12px 12px 28px var(--nm-dark)',
              border: '1px solid var(--nm-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-4 p-6" style={{ borderBottom: '1px solid var(--nm-border)' }}>
              {task.logoUrl && (
                <img
                  src={task.logoUrl}
                  alt={task.title}
                  className="w-14 h-14 rounded-2xl object-cover border border-white/[0.1] shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white leading-tight">{task.title}</h2>
                {task.description && (
                  <p className="text-sm text-slate-400 mt-1">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {dueDate && (
                    <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                      isOverdue ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.06] text-slate-400'
                    }`}>
                      <Calendar className="w-3.5 h-3.5" />
                      Enc. {formatDateBR(dueDate)}
                    </span>
                  )}
                  {task.isPriorityToday && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      Prioridade
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Meetings count editor */}
            <div className="px-6 pt-5 pb-3">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-purple-500/[0.06] border border-purple-500/15">
                <Users className="w-5 h-5 text-purple-400 shrink-0" />
                <div className="flex-1">
                  <label className="text-xs font-medium text-purple-300 block mb-1">Quantidade de reuniões feitas</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={editModalMeetings}
                      onChange={(e) => setEditModalMeetings(e.target.value)}
                      className="h-8 w-20 text-sm bg-white/[0.04] border-white/[0.12] text-white rounded-lg"
                    />
                    <button
                      onClick={handleSaveMeetingsFromModal}
                      disabled={parseInt(editModalMeetings, 10) === task.meetingsCount}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white text-xs font-medium cursor-pointer transition-colors"
                    >
                      <Save className="w-3 h-3" /> Salvar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tasks section */}
            <div className="px-6 pb-3 pt-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-slate-200">Tarefas</span>
                  {activeTasks.length > 0 && (
                    <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold px-1.5">
                      {activeTasks.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova Tarefa
                </button>
              </div>

              {activeTasks.length > 0 && (
                <div className="space-y-1.5">
                  {activeTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.09] transition-colors group/item">
                      <button
                        onClick={() => updateTask.mutate({ id: t.id, completedAt: new Date().toISOString() })}
                        className="shrink-0 w-5 h-5 rounded-full border border-white/20 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center cursor-pointer transition-colors"
                        title="Concluir"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white leading-snug">{t.title}</p>
                        {t.dueDate && (
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(t.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {completedCardTasks.length > 0 && (
                <div className="pt-1 space-y-1">
                  <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider pb-1">
                    Concluídas ({completedCardTasks.length})
                  </p>
                  {completedCardTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500/60 shrink-0" />
                      <p className="text-xs text-slate-600 line-through truncate">{t.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── Modal de criação de tarefa ──────────────── */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => setCreateModalOpen(false)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-md rounded-2xl"
            style={{
              background: 'var(--nm-bg)',
              boxShadow: '-10px -10px 24px var(--nm-light), 10px 10px 24px var(--nm-dark)',
              border: '1px solid var(--nm-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--nm-border)' }}>
              <div>
                <h3 className="text-base font-bold text-white">Nova Tarefa</h3>
                <p className="text-xs text-slate-500 mt-0.5">{task.title}</p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Descrição</label>
                <textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Descreva a tarefa..."
                  rows={3}
                  autoFocus
                  className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/40 resize-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Prazo</label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="bg-white/[0.04] border-white/[0.1] text-white [color-scheme:dark] rounded-xl h-10 text-sm focus-visible:ring-1 focus-visible:ring-purple-500/40"
                />
              </div>
            </div>

            {createTask.isError && (
              <p className="px-6 pb-2 text-xs text-red-400">
                Erro: {(createTask.error as Error)?.message ?? 'Tente novamente.'}
              </p>
            )}

            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="flex-1 h-10 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTask}
                disabled={createTask.isPending}
                className="flex-1 h-10 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {createTask.isPending ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Criar Tarefa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Confirmação de Exclusão ──────────────── */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteModalOpen(false)} />
          <div
            className="relative z-10 w-full max-w-sm rounded-2xl p-6"
            style={{
              background: 'var(--nm-bg)',
              boxShadow: '-10px -10px 24px var(--nm-light), 10px 10px 24px var(--nm-dark)',
              border: '1px solid var(--nm-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Excluir cadastro</h3>
            <p className="text-sm text-slate-400 mb-6">
              Isso apaga o cliente para sempre, sem deixar histórico — use só para corrigir um cadastro errado ou
              duplicado. Se o cliente cancelou o contrato, use &quot;Encerrar contrato&quot; para manter o registro
              da saída.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteTask.mutate(task.id)
                  setDeleteModalOpen(false)
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-500 transition-colors cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de motivo de encerramento ──────────── */}
      {churnModalOpen && (
        <ChurnReasonModal
          clientName={task.title}
          onConfirm={handleEncerrarContrato}
          onCancel={() => setChurnModalOpen(false)}
          isSaving={updateTask.isPending || createColumn.isPending}
        />
      )}
    </>
  )
}
