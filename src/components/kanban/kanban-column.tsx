'use client'

import { useState } from 'react'
import type { Column as ColumnType } from '@/types'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskCard } from './task-card'
import { useCreateTask, useDeleteColumn, useUpdateColumn } from '@/hooks/api'
import { Plus, MoreHorizontal, Trash2, Pencil, GripVertical, Check, X, ImagePlus, Palette } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface KanbanColumnProps {
  column: ColumnType
  source?: string
  taskLabel?: string
  onOpenLead?: (leadId: string) => void
}

export const TITLE_COLOR_PRESETS = [
  '#60a5fa',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#ef4444',
]

function normalizeTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

export function getDefaultColumnTitleColor(title: string) {
  const normalized = normalizeTitle(title)
  if (normalized === 'ganho') return '#22c55e'
  if (normalized === 'perdido') return '#ef4444'

  const colorIdx = Math.abs(title.charCodeAt(0)) % TITLE_COLOR_PRESETS.length
  return TITLE_COLOR_PRESETS[colorIdx]
}

function formatCurrencyShort(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseCurrencyInput(value: string) {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/[R$]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  const number = Number(normalized)
  return Number.isFinite(number) ? Math.max(0, number) : 0
}

function parseNegotiationValue(description: string | null | undefined) {
  if (!description) return 0

  const valueText = description.split(/\s(?:·|Â·)\s/).at(-1) ?? ''
  return parseCurrencyInput(valueText)
}

function parseDateLocal(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0).toISOString()
}

export function KanbanColumn({ column, source = 'kanban', taskLabel = 'cliente', onOpenLead }: KanbanColumnProps) {
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskLogo, setNewTaskLogo] = useState<string | null>(null)
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [newNegotiationService, setNewNegotiationService] = useState('')
  const [newNegotiationValue, setNewNegotiationValue] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(column.title)
  const [editColumnColor, setEditColumnColor] = useState(column.color || getDefaultColumnTitleColor(column.title))

  const createTask = useCreateTask()
  const deleteColumn = useDeleteColumn()
  const updateColumn = useUpdateColumn()
  const isNegotiationBoard = source === 'negotiations'

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `column-droppable-${column.id}`,
    data: { type: 'column', column },
  })

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `column-${column.id}`,
    data: { type: 'column-sortable', column },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setNewTaskLogo(reader.result as string)
    reader.readAsDataURL(file)
  }

  const resetAddTaskForm = () => {
    setNewTaskTitle('')
    setNewTaskLogo(null)
    setNewTaskDueDate('')
    setNewNegotiationService('')
    setNewNegotiationValue('')
    setIsAddingTask(false)
  }

  const handleAddTask = () => {
    const title = newTaskTitle.trim()
    const service = newNegotiationService.trim()
    const negotiationValue = parseCurrencyInput(newNegotiationValue)
    const canCreateNegotiation = !isNegotiationBoard || (service && newTaskDueDate && negotiationValue > 0)

    if (title && canCreateNegotiation) {
      createTask.mutate({
        title,
        description: isNegotiationBoard ? `${service} · ${formatCurrency(negotiationValue)}` : undefined,
        columnId: column.id,
        dueDate: newTaskDueDate ? parseDateLocal(newTaskDueDate) : undefined,
        logoUrl: newTaskLogo || undefined,
        source,
      })
      resetAddTaskForm()
    }
  }

  const handleSaveTitle = () => {
    const nextTitle = editTitle.trim()
    if (!nextTitle) return

    const nextColor = editColumnColor || getDefaultColumnTitleColor(nextTitle)
    const currentColor = column.color || getDefaultColumnTitleColor(column.title)
    const titleChanged = nextTitle !== column.title
    const colorChanged = nextColor !== currentColor

    if (titleChanged || colorChanged) {
      updateColumn.mutate({
        id: column.id,
        title: nextTitle,
        color: nextColor,
      })
    }
    setIsEditingTitle(false)
  }

  const startTitleEdit = () => {
    setEditTitle(column.title)
    setEditColumnColor(column.color || getDefaultColumnTitleColor(column.title))
    setIsEditingTitle(true)
  }

  const taskIds = column.tasks.map((t) => t.id)

  const negotiationTotal = isNegotiationBoard
    ? column.tasks.reduce((sum, task) => sum + (task.negotiation?.totalValue ?? parseNegotiationValue(task.description)), 0)
    : 0
  const columnTitleColor = column.color || getDefaultColumnTitleColor(column.title)

  return (
    <div
      ref={setSortableRef}
      style={{
        ...style,
        background: 'var(--nm-bg)',
        boxShadow: isDragging
          ? 'inset -5px -5px 12px var(--nm-light), inset 5px 5px 12px var(--nm-dark)'
          : isOver
            ? '-8px -8px 18px var(--nm-light), 8px 8px 18px var(--nm-dark), 0 0 0 2px #6366f160'
            : '-8px -8px 18px var(--nm-light), 8px 8px 18px var(--nm-dark)',
        border: column.color ? `1px solid ${columnTitleColor}35` : '1px solid var(--nm-border)',
        transition: 'box-shadow 0.2s ease, opacity 0.15s ease',
        opacity: isDragging ? 0.55 : 1,
      }}
      className="flex flex-col w-[320px] shrink-0 rounded-2xl"
    >
      {/* Column header */}
      <div className="p-4 rounded-t-2xl" style={{ borderBottom: '1px solid var(--nm-border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing hover:bg-white/[0.06] transition-colors shrink-0"
              aria-label="Arrastar coluna"
            >
              <GripVertical className="w-4 h-4" />
            </button>

            {isEditingTitle ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle()
                      if (e.key === 'Escape') {
                        setIsEditingTitle(false)
                        setEditTitle(column.title)
                        setEditColumnColor(column.color || getDefaultColumnTitleColor(column.title))
                      }
                    }}
                    autoFocus
                    className="h-7 w-32 text-xs font-semibold bg-white/[0.06] border-white/[0.12] text-white rounded-lg focus-visible:ring-1 focus-visible:ring-white/20"
                  />
                  <button onClick={handleSaveTitle} className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { setIsEditingTitle(false); setEditTitle(column.title); setEditColumnColor(column.color || getDefaultColumnTitleColor(column.title)) }} className="p-1 text-slate-500 hover:text-slate-300 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex items-center gap-1.5">
                  <label
                    className="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.05] text-white/70"
                    title="Escolher cor"
                  >
                    <Palette className="h-3.5 w-3.5" />
                    <input
                      type="color"
                      value={editColumnColor}
                      onChange={(e) => setEditColumnColor(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      aria-label="Escolher cor da coluna"
                    />
                  </label>
                  <div className="grid flex-1 grid-cols-4 gap-1">
                    {TITLE_COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditColumnColor(color)}
                        title={color}
                        className="h-5 rounded-md transition-transform hover:scale-105 cursor-pointer"
                        style={{
                          backgroundColor: color,
                          outline: editColumnColor === color ? `2px solid ${color}` : '2px solid transparent',
                          outlineOffset: '2px',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ring-1 flex-1 min-w-0"
                style={{
                  backgroundColor: `${columnTitleColor}12`,
                  borderColor: `${columnTitleColor}30`,
                  color: columnTitleColor,
                  boxShadow: `0 0 0 1px ${columnTitleColor}12`,
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: columnTitleColor }} />
                <span className="truncate">{column.title}</span>
                <span className="opacity-70 text-[10px] font-bold bg-white/10 px-1.5 py-0.5 rounded-full leading-none shrink-0">{column.tasks.length}</span>
              </div>
            )}

            {!isEditingTitle && (
              <>
                  <button
                    type="button"
                    onClick={startTitleEdit}
                    className="flex h-6 w-6 items-center justify-center rounded-md border transition-all cursor-pointer shrink-0"
                    style={{
                      backgroundColor: `${columnTitleColor}12`,
                      borderColor: `${columnTitleColor}35`,
                      color: columnTitleColor,
                    }}
                    aria-label={`Editar cor da coluna ${column.title}`}
                    title="Editar cor do título"
                  >
                    <Palette className="w-3.5 h-3.5" />
                  </button>
                <button
                  type="button"
                  onClick={startTitleEdit}
                  className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
                  aria-label={`Editar coluna ${column.title}`}
                  title="Editar nome e cor"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] cursor-pointer outline-none transition-colors">
                <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0f111a] border-white/[0.08] shadow-xl shadow-black/60 rounded-xl">
              <DropdownMenuItem onClick={startTitleEdit} className="text-slate-300 focus:text-white focus:bg-white/[0.06] cursor-pointer text-xs rounded-lg m-1">
                <Pencil className="w-3.5 h-3.5 mr-2 text-slate-400" /> Editar nome e cor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteColumn.mutate(column.id)} className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer text-xs rounded-lg m-1">
                <Trash2 className="w-3.5 h-3.5 mr-2 text-red-400/80" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isNegotiationBoard && (
          <div className="mf-negotiation-column-total" title={`Total em negociação: ${formatCurrencyShort(negotiationTotal)}`}>
            <span>Total em negociação</span>
            <strong>{formatCurrencyShort(negotiationTotal)}</strong>
          </div>
        )}
      </div>

      {/* Tasks list */}
      <div ref={setDroppableRef} className="flex-1 p-3 space-y-2 min-h-[80px] overflow-y-auto max-h-[calc(100vh-260px)]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpenLead={onOpenLead} />
          ))}
        </SortableContext>

        {column.tasks.length === 0 && !isAddingTask && (
          <div className="flex items-center justify-center h-20 text-slate-600 text-sm">
            {taskLabel === 'negociação' ? 'Nenhuma negociação' : 'Nenhum cliente'}
          </div>
        )}
      </div>

      {/* Add task */}
      <div className="p-3 pt-0">
        {isAddingTask ? (
          <div className="space-y-2.5">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask()
                  if (e.key === 'Escape') resetAddTaskForm()
                }}
              placeholder={isNegotiationBoard ? 'Nome do cliente...' : `Nome ${taskLabel === 'negociação' ? 'da' : 'do'} ${taskLabel}...`}
              autoFocus
              className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 text-sm rounded-xl"
            />

            {isNegotiationBoard && (
              <>
                <Input
                  value={newNegotiationService}
                  onChange={(e) => setNewNegotiationService(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTask()
                    if (e.key === 'Escape') resetAddTaskForm()
                  }}
                  placeholder="Serviço negociado..."
                  className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 text-sm rounded-xl"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium mb-1 block">Previsão de fechamento</label>
                    <Input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="bg-white/[0.04] border-white/[0.1] text-white [color-scheme:dark] text-sm rounded-xl h-9"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium mb-1 block">Valor</label>
                    <Input
                      inputMode="decimal"
                      value={newNegotiationValue}
                      onChange={(e) => setNewNegotiationValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTask()
                        if (e.key === 'Escape') resetAddTaskForm()
                      }}
                      placeholder="R$ 0,00"
                      className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 text-sm rounded-xl h-9"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Logo upload */}
            <div className="flex items-center gap-2.5">
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.2] text-slate-400 hover:text-white text-xs font-medium w-full">
                <ImagePlus className="w-3.5 h-3.5 shrink-0" />
                {newTaskLogo ? 'Trocar logo' : 'Adicionar logo'}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </label>
              {newTaskLogo && (
                <img src={newTaskLogo} alt="logo preview" className="w-8 h-8 rounded-lg object-cover border border-white/[0.1] shrink-0" />
              )}
            </div>

            {!isNegotiationBoard && (
              <div>
                <label className="text-[11px] text-slate-500 font-medium mb-1 block">Encerramento do contrato</label>
                <Input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="bg-white/[0.04] border-white/[0.1] text-white [color-scheme:dark] text-sm rounded-xl h-9"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddTask}
                disabled={
                  !newTaskTitle.trim()
                  || (isNegotiationBoard && (!newNegotiationService.trim() || !newTaskDueDate || parseCurrencyInput(newNegotiationValue) <= 0))
                }
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs cursor-pointer rounded-lg"
              >
                Adicionar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={resetAddTaskForm}
                className="text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingTask(true)}
            className="flex items-center gap-2 w-full p-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.04] cursor-pointer text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nova {taskLabel}
          </button>
        )}
      </div>
    </div>
  )
}
