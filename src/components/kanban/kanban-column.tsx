'use client'

import { useState } from 'react'
import type { Column as ColumnType } from '@/types'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskCard } from './task-card'
import { useCreateTask, useDeleteColumn, useUpdateColumn } from '@/hooks/api'
import { Plus, MoreHorizontal, Trash2, Pencil, GripVertical, Check, X, ImagePlus } from 'lucide-react'
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
}

export function KanbanColumn({ column, source = 'kanban', taskLabel = 'cliente' }: KanbanColumnProps) {
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskLogo, setNewTaskLogo] = useState<string | null>(null)
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(column.title)

  const createTask = useCreateTask()
  const deleteColumn = useDeleteColumn()
  const updateColumn = useUpdateColumn()

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

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      createTask.mutate({
        title: newTaskTitle.trim(),
        columnId: column.id,
        dueDate: newTaskDueDate || undefined,
        logoUrl: newTaskLogo || undefined,
        source,
      })
      setNewTaskTitle('')
      setNewTaskLogo(null)
      setNewTaskDueDate('')
      setIsAddingTask(false)
    }
  }

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle !== column.title) {
      updateColumn.mutate({ id: column.id, title: editTitle.trim() })
    }
    setIsEditingTitle(false)
  }

  const taskIds = column.tasks.map((t) => t.id)

  const isNegotiationBoard = source === 'negotiations'
  const stageTone = isNegotiationBoard && column.title.toLocaleLowerCase('pt-BR') === 'ganho'
    ? '#4fa24a'
    : isNegotiationBoard && column.title.toLocaleLowerCase('pt-BR') === 'perdido'
      ? '#e05252'
      : null

  // Refined accent colors with better visibility and glassmorphism styling
  const accentColors = [
    { text: 'text-blue-400', dot: 'bg-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/[0.07]', ring: 'ring-blue-500/10' },
    { text: 'text-violet-400', dot: 'bg-violet-400', border: 'border-violet-500/20', bg: 'bg-violet-500/[0.07]', ring: 'ring-violet-500/10' },
    { text: 'text-emerald-400', dot: 'bg-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/[0.07]', ring: 'ring-emerald-500/10' },
    { text: 'text-amber-400', dot: 'bg-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/[0.07]', ring: 'ring-amber-500/10' },
    { text: 'text-rose-400', dot: 'bg-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/[0.07]', ring: 'ring-rose-500/10' },
    { text: 'text-cyan-400', dot: 'bg-cyan-400', border: 'border-cyan-500/20', bg: 'bg-cyan-500/[0.07]', ring: 'ring-cyan-500/10' },
  ]

  const colorIdx = Math.abs(column.title.charCodeAt(0)) % accentColors.length
  const accent = accentColors[colorIdx]

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
        border: stageTone ? `1px solid ${stageTone}` : '1px solid var(--nm-border)',
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
              <div className="flex items-center gap-1">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle()
                    if (e.key === 'Escape') { setIsEditingTitle(false); setEditTitle(column.title) }
                  }}
                  autoFocus
                  className="h-7 w-32 text-xs font-semibold bg-white/[0.06] border-white/[0.12] text-white rounded-lg focus-visible:ring-1 focus-visible:ring-white/20"
                />
                <button onClick={handleSaveTitle} className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => { setIsEditingTitle(false); setEditTitle(column.title) }} className="p-1 text-slate-500 hover:text-slate-300 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${accent.border} ${accent.bg} ${accent.text} ring-1 ${accent.ring}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${accent.dot} animate-pulse`} />
                <span>{column.title}</span>
                <span className="opacity-60 text-[10px] font-bold bg-white/10 px-1.5 py-0.5 rounded-full leading-none shrink-0">{column.tasks.length}</span>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] cursor-pointer outline-none transition-colors">
                <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0f111a] border-white/[0.08] shadow-xl shadow-black/60 rounded-xl">
              <DropdownMenuItem onClick={() => setIsEditingTitle(true)} className="text-slate-300 focus:text-white focus:bg-white/[0.06] cursor-pointer text-xs rounded-lg m-1">
                <Pencil className="w-3.5 h-3.5 mr-2 text-slate-400" /> Renomear
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteColumn.mutate(column.id)} className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer text-xs rounded-lg m-1">
                <Trash2 className="w-3.5 h-3.5 mr-2 text-red-400/80" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tasks list */}
      <div ref={setDroppableRef} className="flex-1 p-3 space-y-2 min-h-[80px] overflow-y-auto max-h-[calc(100vh-260px)]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
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
                if (e.key === 'Escape') { setIsAddingTask(false); setNewTaskTitle(''); setNewTaskLogo(null); setNewTaskDueDate('') }
              }}
              placeholder={`Nome ${taskLabel === 'negociação' ? 'da' : 'do'} ${taskLabel}...`}
              autoFocus
              className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 text-sm rounded-xl"
            />

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
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs cursor-pointer rounded-lg"
              >
                Adicionar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setIsAddingTask(false); setNewTaskTitle(''); setNewTaskLogo(null); setNewTaskDueDate('') }}
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
