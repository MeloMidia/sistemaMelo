'use client'

import { useState, useRef } from 'react'
import type { Task as TaskType } from '@/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Trash2, Calendar, Star, Pencil, Check, X,
  ImagePlus, Plus, ClipboardList, User, MessageCircle,
  CheckCircle2, Clock, Users
} from 'lucide-react'
import { useDeleteTask, useUpdateTask, useCreateTask, useKanbanCardTasks, useColumns } from '@/hooks/api'
import { Input } from '@/components/ui/input'
import {
  buildActionClientCompletionDescription,
  buildActionClientPracticeChecklistDescription,
  buildActionClientPracticeActionsDescription,
  getActionClientDaysRemaining,
  getActionClientStageDaysElapsed,
  normalizePracticeChecklist,
  normalizePracticeActions,
  parseActionClientsDescription,
  parseActionClientTaskDescription,
} from '@/lib/action-clients'
import type { ActionClientPracticeAction } from '@/lib/action-clients'

interface TaskCardProps {
  task: TaskType
  columnTitle?: string
  onOpenLead?: (leadId: string) => void
}

function normalizeTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

// Extrai "YYYY-MM-DD" de um Date/string sem perder dia por timezone
function toLocalDateString(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  // Usa os componentes locais para não sofrer offset UTC
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Converte "YYYY-MM-DD" para Date ao meio-dia local (evita shift UTC)
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

function parseNegotiationPreview(description: string | null | undefined) {
  if (!description) return { service: '', value: '' }

  const parts = description.split(/\s(?:·|Â·)\s/).filter(Boolean)
  if (parts.length >= 2) {
    return {
      service: parts[0],
      value: parts.slice(1).join(' · '),
    }
  }

  return { service: description, value: '' }
}

function parseCurrencyInput(value: string) {
  const rawValue = value
    .replace(/\s/g, '')
    .replace(/[R$]/g, '')
  const normalized = rawValue.includes(',')
    ? rawValue.replace(/\./g, '').replace(',', '.')
    : rawValue

  const number = Number(normalized)
  return Number.isFinite(number) ? Math.max(0, number) : 0
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function TaskCard({ task, columnTitle, onOpenLead }: TaskCardProps) {
  const isNegotiationCard = task.source === 'negotiations'
  const isActionsCard = task.source === 'acoes'
  const normalizedColumnTitle = normalizeTitle(columnTitle ?? '')
  const isActionValidationCard = isActionsCard && normalizedColumnTitle === 'validando novas acoes'
  const isActionDecisionCard = isActionsCard && normalizedColumnTitle === 'decidir'
  const isActionAnalysisCard = isActionsCard && normalizedColumnTitle === 'em analise'
  const isActionPracticeCard = isActionsCard && normalizedColumnTitle === 'quais acoes por em pratica'
  const isActionExecutionCard = isActionsCard && normalizedColumnTitle === 'em pratica'
  const negotiationExpectedCloseAt = task.negotiation?.expectedCloseAt ?? (isNegotiationCard ? task.dueDate : null)
  // Card inline edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDueDate, setEditDueDate] = useState(
    toLocalDateString(isNegotiationCard ? negotiationExpectedCloseAt : isActionsCard ? null : task.dueDate)
  )
  const negotiationPreview = isNegotiationCard ? parseNegotiationPreview(task.description) : null
  const initialNegotiationValue = task.negotiation?.totalValue ?? parseCurrencyInput(negotiationPreview?.value ?? '')
  const [editNegotiationValue, setEditNegotiationValue] = useState(String(initialNegotiationValue))
  const [editLogo, setEditLogo] = useState<string | null>(task.logoUrl)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Detail modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()
  const createTask = useCreateTask()
  const { data: columns } = useColumns('tasks')
  const { data: kanbanColumns } = useColumns()
  const { data: actionColumns } = useColumns('acoes')
  const { data: cardTasks } = useKanbanCardTasks(task.id)
  const negotiationService = negotiationPreview?.service || task.description || 'Negociação criada a partir do lead'
  const negotiationValue = negotiationPreview?.value || ''
  const actionClientTask = isActionsCard ? parseActionClientTaskDescription(task.description) : null
  const actionClients = isActionsCard ? parseActionClientsDescription(task.description) : []
  const actionDaysRemaining = isActionValidationCard
    ? getActionClientDaysRemaining(actionClientTask?.dueAt ?? task.dueDate)
    : null
  const actionProgressDays = isActionDecisionCard
    ? getActionClientStageDaysElapsed(actionClientTask?.decidedAt ?? actionClientTask?.dueAt ?? task.dueDate)
    : isActionAnalysisCard
      ? getActionClientStageDaysElapsed(actionClientTask?.analysisAt)
      : isActionPracticeCard
        ? getActionClientStageDaysElapsed(actionClientTask?.practiceAt ?? actionClientTask?.analysisAt)
        : isActionExecutionCard
          ? getActionClientStageDaysElapsed(actionClientTask?.executionAt ?? actionClientTask?.practiceAt)
      : null
  const actionTimingDay = actionProgressDays ?? actionDaysRemaining
  const actionTimingTone = actionProgressDays !== null
    ? actionProgressDays <= 2
      ? 'green'
      : actionProgressDays === 3
        ? 'yellow'
        : 'red'
    : actionDaysRemaining !== null
      ? actionDaysRemaining === 0
        ? 'red'
        : actionDaysRemaining <= 1
          ? 'yellow'
          : 'green'
      : null
  const actionTimingClass = actionTimingTone === 'red'
    ? 'bg-red-500/10 text-red-400 border-red-500/15'
    : actionTimingTone === 'yellow'
      ? 'bg-amber-500/10 text-amber-300 border-amber-500/15'
      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15'
  const actionTimingLabel = actionProgressDays !== null
    ? `Dia ${actionProgressDays}`
    : actionDaysRemaining !== null
      ? actionDaysRemaining === 0 ? 'Hoje' : `${actionDaysRemaining}d`
      : null

  // Task creation modal state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [taskDesc, setTaskDesc] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [practiceActions, setPracticeActions] = useState(() => normalizePracticeActions(actionClientTask?.practiceActions))
  const [practiceChecklist, setPracticeChecklist] = useState<ActionClientPracticeAction[]>(
    () => normalizePracticeChecklist(actionClientTask?.practiceActions)
  )

  const activeTasks = (cardTasks ?? []).filter(t => !t.completedAt)
  const completedCardTasks = (cardTasks ?? []).filter(t => t.completedAt)

  const handleCreateTask = () => {
    const columnId = columns?.[0]?.id ?? kanbanColumns?.[0]?.id
    const title = taskDesc.trim()
    if (!columnId || !title) return
    const [y, m, d] = (taskDueDate || '').split('-').map(Number)
    createTask.mutate({
      title,
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
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
  }

  // ── Card inline edit handlers ──────────────────────────
  const handleSave = () => {
    if (!editTitle.trim()) return
    const nextNegotiationValue = isNegotiationCard ? parseCurrencyInput(editNegotiationValue) : null
    updateTask.mutate({
      id: task.id,
      title: editTitle.trim(),
      dueDate: !isActionsCard && editDueDate ? parseDateLocal(editDueDate) : null,
      logoUrl: editLogo,
      ...(isNegotiationCard ? {
        description: `${negotiationService} \u00b7 ${formatCurrency(nextNegotiationValue ?? 0)}`,
        negotiationTotalValue: nextNegotiationValue ?? 0,
      } : {}),
    })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditTitle(task.title)
    setEditDueDate(toLocalDateString(isNegotiationCard ? negotiationExpectedCloseAt : isActionsCard ? null : task.dueDate))
    setEditNegotiationValue(String(task.negotiation?.totalValue ?? parseCurrencyInput(negotiationPreview?.value ?? '')))
    setEditLogo(task.logoUrl)
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

  const handlePracticeActionChange = (index: number, value: string) => {
    setPracticeActions((current) => current.map((action, actionIndex) => (
      actionIndex === index ? value : action
    )))
  }

  const handleSavePracticeActions = () => {
    const description = buildActionClientPracticeActionsDescription(task.description, practiceActions)
    if (!description) return

    updateTask.mutate({
      id: task.id,
      description,
    })
  }

  const handleCompletePracticeAction = (index: number) => {
    if (!actionClientTask) return

    const nextChecklist = practiceChecklist.map((action, actionIndex) => (
      actionIndex === index
        ? { ...action, completedAt: action.completedAt ? undefined : new Date().toISOString() }
        : action
    ))
    setPracticeChecklist(nextChecklist)

    const filledActions = nextChecklist.filter((action) => action.text.trim())
    const allActionsCompleted = filledActions.length > 0 && filledActions.every((action) => action.completedAt)
    if (!allActionsCompleted) {
      const description = buildActionClientPracticeChecklistDescription(task.description, nextChecklist)
      if (description) updateTask.mutate({ id: task.id, description })
      return
    }

    const validationColumn = actionColumns?.find((column) => normalizeTitle(column.title) === 'validando novas acoes')
    const description = buildActionClientCompletionDescription(task.description, new Date().toISOString())
    if (!description || !validationColumn) return

    const validationOrder = Math.max(0, ...validationColumn.tasks.map((validationTask) => validationTask.order)) + 1000
    updateTask.mutate({
      id: task.id,
      description,
      columnId: validationColumn.id,
      order: validationOrder,
    }, {
      onSuccess: () => setModalOpen(false),
    })
  }

  // ── Modal open handler ────────────────────────────────
  const handleOpenModal = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('textarea')) return
    if (isEditing || (isActionsCard && !isActionPracticeCard && !isActionExecutionCard)) return
    if (isActionPracticeCard) {
      setPracticeActions(normalizePracticeActions(actionClientTask?.practiceActions))
    }
    if (isActionExecutionCard) {
      setPracticeChecklist(normalizePracticeChecklist(actionClientTask?.practiceActions))
    }
    setModalOpen(true)
  }

  const dueDate = isNegotiationCard || isActionsCard ? null : (task.dueDate ? new Date(task.dueDate) : null)
  const negotiationCloseDate = isNegotiationCard && negotiationExpectedCloseAt ? new Date(negotiationExpectedCloseAt) : null
  const isOverdue = dueDate && dueDate < new Date()
  const isNegotiationCloseOverdue = negotiationCloseDate && negotiationCloseDate < new Date()

  // Dynamic monogram colors for cards without logos
  const initial = task.title.charAt(0).toUpperCase()
  const monogramStyles = [
    'from-blue-500/20 to-indigo-600/10 text-blue-300 ring-1 ring-blue-500/25',
    'from-purple-500/20 to-fuchsia-600/10 text-purple-300 ring-1 ring-purple-500/25',
    'from-emerald-500/20 to-teal-600/10 text-emerald-300 ring-1 ring-emerald-500/25',
    'from-amber-500/20 to-orange-600/10 text-amber-300 ring-1 ring-amber-500/25',
    'from-rose-500/20 to-pink-600/10 text-rose-300 ring-1 ring-rose-500/25',
    'from-cyan-500/20 to-blue-600/10 text-cyan-300 ring-1 ring-cyan-500/25',
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
            ? 'inset -3px -3px 7px var(--nm-light), inset 3px 3px 7px var(--nm-dark)'
            : '-3px -3px 8px var(--nm-light), 3px 3px 8px var(--nm-dark)',
          border: task.isPriorityToday && !isDragging
            ? '1px solid rgba(245,158,11,0.35)'
            : '1px solid var(--nm-border)',
          borderLeft: task.isPriorityToday && !isDragging
            ? '2px solid rgba(245,158,11,0.6)'
            : undefined,
          opacity: isDragging ? 0.5 : 1,
          transition: 'box-shadow 0.2s ease, transform 0.15s ease, opacity 0.15s ease',
        }}
        className={`group relative p-3.5 rounded-xl nm-card-hover ${!isEditing && (!isActionsCard || isActionPracticeCard || isActionExecutionCard) ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-start gap-2.5">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 p-0.5 rounded text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing shrink-0 hover:bg-white/[0.04] transition-colors"
            aria-label="Arrastar tarefa"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              /* ── Edit mode ── */
              <div className="space-y-2.5" onClick={(e) => e.stopPropagation()}>
                {/* Logo edit */}
                {!isActionsCard && (
                <div className="flex items-center gap-3">
                  {editLogo ? (
                    <img
                      src={editLogo}
                      alt="logo"
                      className="w-10 h-10 rounded-xl object-cover border border-white/[0.15] shrink-0"
                    />
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
                    <button
                      type="button"
                      onClick={() => setEditLogo(null)}
                      className="text-xs text-red-400/70 hover:text-red-400 cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </div>
                )}

                {/* Title edit */}
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave()
                    if (e.key === 'Escape') handleCancel()
                  }}
                  placeholder={isActionsCard ? 'Nome da ação...' : 'Nome do cliente...'}
                  autoFocus
                  className="h-8 text-sm bg-white/[0.04] border-white/[0.12] text-white rounded-lg focus-visible:ring-1 focus-visible:ring-white/20"
                />

                {isNegotiationCard && (
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">
                      Valor total
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editNegotiationValue}
                      onChange={(e) => setEditNegotiationValue(e.target.value)}
                      className="h-8 text-sm bg-white/[0.04] border-white/[0.12] text-white rounded-lg focus-visible:ring-1 focus-visible:ring-white/20"
                    />
                  </div>
                )}

                {!isActionsCard && (
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">
                    {isNegotiationCard ? 'Previsão de fechamento' : 'Encerramento do contrato'}
                  </label>
                  <Input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="h-8 text-sm bg-white/[0.04] border-white/[0.12] text-white [color-scheme:dark] rounded-lg"
                  />
                </div>
                )}

                {/* Save / Cancel */}
                <div className="flex gap-2 pt-0.5">
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer transition-colors"
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
              /* ── View mode ── */
              <>
                {/* Logo + title */}
                <div className="flex items-center gap-3 min-w-0">
                  {task.logoUrl ? (
                    <img
                      src={task.logoUrl}
                      alt={`${task.title} logo`}
                      className={`${isNegotiationCard ? 'w-9 h-9 rounded-full' : 'w-9 h-9 rounded-xl'} object-cover border border-white/[0.08] shrink-0`}
                    />
                  ) : (
                    <div className={`${isNegotiationCard ? 'w-9 h-9 rounded-full' : 'w-9 h-9 rounded-xl'} flex items-center justify-center text-xs font-bold shrink-0 bg-gradient-to-br ${placeholderStyle}`}>
                      {initial}
                    </div>
                  )}
                  <p className="text-sm font-semibold text-white leading-snug tracking-tight">
                    {task.title}
                  </p>
                  {isNegotiationCard && task.leadId && onOpenLead && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpenLead(task.leadId as string)
                      }}
                      className="shrink-0 p-1.5 rounded-lg text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer transition-colors"
                      title="Abrir conversa no WhatsApp"
                      aria-label={`Abrir conversa de ${task.title} no WhatsApp`}
                    >
                      <MessageCircle className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {isNegotiationCard ? (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{negotiationService}</p>
                ) : isActionsCard && actionClients.length > 0 ? (
                  <div className="mt-3 rounded-lg bg-teal-400/[0.06] px-2.5 py-2 ring-1 ring-teal-400/15">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-teal-200">
                      <Users className="h-3 w-3" />
                      {actionClients.length} clientes da Assessoria
                    </div>
                    <p className="mt-1 truncate text-[11px] text-white/45">
                      {actionClients.slice(0, 4).map((client) => client.title).join(', ')}
                      {actionClients.length > 4 ? ` +${actionClients.length - 4}` : ''}
                    </p>
                  </div>
                ) : !isActionsCard && task.description ? (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{task.description}</p>
                ) : null}

                {isNegotiationCard ? (
                  <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-white/[0.03]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {task.assignee && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400 border border-white/[0.05]">
                          <User className="w-3 h-3 shrink-0" />
                          {task.assignee}
                        </span>
                      )}
                      {negotiationCloseDate && (
                        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                          isNegotiationCloseOverdue
                            ? 'bg-red-500/10 text-red-400 border-red-500/15'
                            : 'bg-sky-500/10 text-sky-300 border-sky-500/15'
                        }`}>
                          <Calendar className="w-3 h-3 shrink-0" />
                          Fecha {formatDateBR(negotiationCloseDate)}
                        </span>
                      )}
                    </div>
                    {negotiationValue && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 tabular-nums">
                        {negotiationValue}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    {isActionsCard && actionClientTask && actionTimingDay !== null && actionTimingLabel && (
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${actionTimingClass}`}>
                        <Clock className="w-3 h-3 shrink-0" />
                        {actionTimingLabel}
                      </span>
                    )}
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
                    {!isActionsCard && activeTasks.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/15">
                        <ClipboardList className="w-3 h-3 shrink-0" />
                        {activeTasks.length} {activeTasks.length === 1 ? 'tarefa' : 'tarefas'}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action buttons — only in view mode */}
          {!isEditing && (
            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity duration-200" onClick={(e) => e.stopPropagation()}>
              {isNegotiationCard ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors"
                  title="Editar"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              ) : (
                <>
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
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteModalOpen(true)
                }}
                className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                title="Excluir"
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
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

          <div
            className="relative z-10 w-full max-w-xl rounded-2xl flex flex-col max-h-[85vh]"
            style={{
              background: 'var(--nm-bg)',
              boxShadow: '-12px -12px 28px var(--nm-light), 12px 12px 28px var(--nm-dark), 0 0 0 1px var(--nm-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-5 shrink-0" style={{ borderBottom: '1px solid var(--nm-border)' }}>
              {task.logoUrl ? (
                <img
                  src={task.logoUrl}
                  alt={task.title}
                  className={`${isNegotiationCard ? 'w-12 h-12 rounded-full' : 'w-12 h-12 rounded-xl'} object-cover border border-white/[0.1] shrink-0`}
                />
              ) : (
                <div className={`${isNegotiationCard ? 'w-12 h-12 rounded-full' : 'w-12 h-12 rounded-xl'} flex items-center justify-center text-sm font-bold shrink-0 bg-gradient-to-br ${placeholderStyle}`}>
                  {initial}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white leading-tight truncate">{task.title}</h2>
                {isNegotiationCard ? (
                  <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">{negotiationService}</p>
                ) : isActionPracticeCard ? (
                  <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">Quais ações pôr em prática</p>
                ) : isActionsCard && actionClients.length > 0 ? (
                  <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">{actionClients.length} clientes da Assessoria vinculados</p>
                ) : !isActionsCard && task.description ? (
                  <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">{task.description}</p>
                ) : null}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {isNegotiationCard && task.negotiation?.negotiatedAt && (
                    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400">
                      <Calendar className="w-3 h-3" />
                      Negociado {formatDateBR(task.negotiation.negotiatedAt)}
                    </span>
                  )}
                  {isNegotiationCard && negotiationCloseDate && (
                    <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      isNegotiationCloseOverdue ? 'bg-red-500/15 text-red-400' : 'bg-sky-500/15 text-sky-300'
                    }`}>
                      <Calendar className="w-3 h-3" />
                      Fecha {formatDateBR(negotiationCloseDate)}
                    </span>
                  )}
                  {isActionsCard && actionClientTask && actionTimingDay !== null && actionTimingLabel && (
                    <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${actionTimingClass}`}>
                      <Clock className="w-3 h-3" />
                      {actionTimingLabel}
                    </span>
                  )}
                  {!isNegotiationCard && dueDate && (
                    <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      isOverdue ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.06] text-slate-400'
                    }`}>
                      <Calendar className="w-3 h-3" />
                      Enc. {formatDateBR(dueDate)}
                    </span>
                  )}
                  {task.isPriorityToday && (
                    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                      <Star className="w-3 h-3 fill-current" />
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

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {isActionExecutionCard && actionClientTask ? (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-emerald-400/[0.055] p-4 ring-1 ring-emerald-400/15">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-200">Checklist de execucao</p>
                        <p className="mt-1 text-sm font-semibold text-white">Conclua as acoes deste cliente</p>
                      </div>
                      {actionTimingLabel && (
                        <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold tabular-nums ${actionTimingClass}`}>
                          {actionTimingLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-white/45">
                      Ao finalizar todas as acoes, o cliente volta automaticamente para Validando novas acoes.
                    </p>
                  </div>

                  {practiceChecklist.filter((action) => action.text.trim()).map((action) => {
                    const index = practiceChecklist.indexOf(action)
                    return (
                      <div key={index} className={`flex items-center gap-3 rounded-2xl p-3 ring-1 transition-colors ${action.completedAt ? 'bg-emerald-400/[0.06] ring-emerald-400/20' : 'bg-white/[0.025] ring-white/[0.055]'}`}>
                        <button
                          type="button"
                          onClick={() => handleCompletePracticeAction(index)}
                          disabled={updateTask.isPending}
                          className={`flex min-h-10 flex-1 items-center gap-3 rounded-xl px-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-50 ${action.completedAt ? 'text-emerald-200' : 'text-white hover:bg-white/[0.04]'}`}
                        >
                          <CheckCircle2 className={`h-5 w-5 shrink-0 ${action.completedAt ? 'fill-emerald-400/20 text-emerald-300' : 'text-white/25'}`} />
                          <span className={`text-sm leading-relaxed ${action.completedAt ? 'line-through opacity-70' : ''}`}>{action.text}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompletePracticeAction(index)}
                          disabled={updateTask.isPending}
                          className={`min-h-10 shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors disabled:pointer-events-none disabled:opacity-50 ${action.completedAt ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/[0.05] text-white/45 hover:bg-emerald-400/10 hover:text-emerald-200'}`}
                        >
                          {action.completedAt ? 'Finalizado' : 'Finalizar'}
                        </button>
                      </div>
                    )
                  })}

                  {practiceChecklist.every((action) => !action.text.trim()) && (
                    <p className="rounded-xl bg-amber-400/[0.06] px-3 py-3 text-center text-xs text-amber-200/75 ring-1 ring-amber-400/15">
                      Cadastre as acoes na etapa anterior para iniciar o checklist.
                    </p>
                  )}

                  {(actionClientTask.completionHistory?.length ?? 0) > 0 && (
                    <div className="border-t border-white/[0.06] pt-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/35">Historico de conclusoes</p>
                      <div className="space-y-1.5">
                        {actionClientTask.completionHistory?.slice().reverse().map((record, index) => (
                          <div key={`${record.completedAt}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.025] px-3 py-2 text-xs">
                            <span className="text-white/65">Ciclo concluido</span>
                            <span className="text-white/40">{formatDateBR(record.completedAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : isActionPracticeCard && actionClientTask ? (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-teal-400/[0.055] p-4 ring-1 ring-teal-400/15">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-teal-200">Ações para execução</p>
                        <p className="mt-1 text-sm font-semibold text-white">{task.title}</p>
                      </div>
                      {actionTimingLabel && (
                        <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold tabular-nums ${actionTimingClass}`}>
                          {actionTimingLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-white/45">
                      Defina até três ações para colocar em prática com este cliente.
                    </p>
                  </div>

                  {practiceActions.map((action, index) => (
                    <label key={index} className="block rounded-2xl bg-white/[0.025] p-3 ring-1 ring-white/[0.055]">
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-white/45">
                        {index + 1} - Ação
                      </span>
                      <textarea
                        value={action}
                        onChange={(event) => handlePracticeActionChange(index, event.target.value)}
                        rows={2}
                        className="min-h-16 w-full resize-none rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-slate-600 focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/10"
                        placeholder="Descreva a ação..."
                      />
                    </label>
                  ))}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPracticeActions(normalizePracticeActions(actionClientTask.practiceActions))}
                      className="h-9 rounded-xl bg-white/[0.04] px-3 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                      Desfazer
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePracticeActions}
                      disabled={updateTask.isPending}
                      className="h-9 rounded-xl bg-teal-500/15 px-4 text-xs font-bold text-teal-100 ring-1 ring-teal-400/20 transition-colors hover:bg-teal-500/25 disabled:pointer-events-none disabled:opacity-45"
                    >
                      {updateTask.isPending ? 'Salvando...' : 'Salvar ações'}
                    </button>
                  </div>
                </div>
              ) : (
              <>
              {isActionsCard && actionClientTask && (
                <div className="rounded-2xl bg-teal-400/[0.055] p-4 ring-1 ring-teal-400/15">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-teal-200">Ação em validação</p>
                      <p className="mt-1 text-sm font-semibold text-white">{actionClientTask.actionTitle}</p>
                    </div>
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums ${
                      actionDaysRemaining === 0
                        ? 'bg-red-500/10 text-red-300'
                        : 'bg-teal-400/10 text-teal-100'
                    }`}>
                      {actionDaysRemaining === 0 ? 'Hoje' : `${actionDaysRemaining ?? 0}d`}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-white/45">
                    Quando a contagem chegar a zero, este cliente vai automaticamente para a coluna Decidir.
                  </p>
                </div>
              )}

              {isActionsCard && actionClients.length > 0 && (
                <div className="rounded-2xl bg-teal-400/[0.055] p-4 ring-1 ring-teal-400/15">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-teal-300" />
                      <span className="text-sm font-semibold text-slate-200">Clientes da Assessoria</span>
                    </div>
                    <span className="rounded-lg bg-teal-400/10 px-2.5 py-1 text-xs font-bold text-teal-100 tabular-nums">
                      {actionClients.length}
                    </span>
                  </div>
                  <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {actionClients.map((client) => (
                      <div key={client.id} className="flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.035] px-3 py-2 ring-1 ring-white/[0.04]">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-400/10 text-[11px] font-bold text-teal-200">
                          {client.title.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 truncate text-sm font-medium text-white/75">{client.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-1">
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

              {/* Lista de tarefas ativas */}
              {activeTasks.length > 0 ? (
                <div className="space-y-1.5">
                  {activeTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.09] transition-colors group/item">
                      <button
                        onClick={() => updateTask.mutate({ id: t.id, completedAt: new Date().toISOString() })}
                        className="shrink-0 w-5 h-5 rounded-full border border-white/20 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center cursor-pointer transition-colors"
                        title="Concluir"
                      />
                      <div className="flex-1 min-w-0">
                        {/* Tarefas antigas guardavam o texto real em description
                            (title era só uma cópia do nome do card) — mostra o
                            que tiver de mais útil, sem precisar migrar dado. */}
                        <p className="text-sm font-medium text-white leading-snug">{t.description || t.title}</p>
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
              ) : (
                <p className="text-xs text-slate-600 text-center py-6">Nenhuma tarefa ainda</p>
              )}

              {/* Concluídas */}
              {completedCardTasks.length > 0 && (
                <div className="pt-2 space-y-1">
                  <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider pb-1">
                    Concluídas ({completedCardTasks.length})
                  </p>
                  {completedCardTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500/60 shrink-0" />
                      <p className="text-xs text-slate-600 line-through truncate">{t.description || t.title}</p>
                    </div>
                  ))}
                </div>
              )}
              </>
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
            style={{ background: 'var(--nm-bg)', boxShadow: '-10px -10px 24px var(--nm-light), 10px 10px 24px var(--nm-dark), 0 0 0 1px var(--nm-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
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

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">O que precisa ser feito?</label>
                <textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Ex: Enviar contrato assinado"
                  rows={3}
                  className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/40 resize-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Prazo</label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="bg-white/[0.04] border-white/[0.1] text-white [color-scheme:dark] rounded-xl h-10 text-sm focus-visible:ring-1 focus-visible:ring-blue-500/40"
                />
              </div>
            </div>

            {/* Error feedback */}
            {createTask.isError && (
              <p className="px-6 pb-2 text-xs text-red-400">
                Erro: {(createTask.error as Error)?.message ?? 'Tente novamente.'}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="flex-1 h-10 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTask}
                disabled={createTask.isPending || !taskDesc.trim()}
                className="flex-1 h-10 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
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
            style={{ background: 'var(--nm-bg)', boxShadow: '-10px -10px 24px var(--nm-light), 10px 10px 24px var(--nm-dark), 0 0 0 1px var(--nm-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Excluir Tarefa</h3>
            <p className="text-sm text-slate-400 mb-6">Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.</p>
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

    </>
  )
}
