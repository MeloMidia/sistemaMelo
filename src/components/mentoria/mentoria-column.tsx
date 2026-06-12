'use client'

import { useState } from 'react'
import type { Column as ColumnType } from '@/types'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MentoriaTaskCard } from './mentoria-task-card'
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

interface MentoriaColumnProps {
  column: ColumnType
}

export function MentoriaColumn({ column }: MentoriaColumnProps) {
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskLogo, setNewTaskLogo] = useState<string | null>(null)
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [newTaskMeetings, setNewTaskMeetings] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(column.title)

  const createTask = useCreateTask()
  const deleteColumn = useDeleteColumn()
  const updateColumn = useUpdateColumn()

  const { setNodeRef: setDroppableRef } = useDroppable({
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
        source: 'mentoria',
        meetingsCount: newTaskMeetings ? parseInt(newTaskMeetings, 10) : 0,
      } as any)
      setNewTaskTitle('')
      setNewTaskLogo(null)
      setNewTaskDueDate('')
      setNewTaskMeetings('')
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

  const accentColors = [
    { header: 'from-purple-500/15 to-purple-500/[0.03]', dot: 'bg-purple-400', badge: 'bg-purple-500/15 text-purple-300' },
    { header: 'from-fuchsia-500/15 to-fuchsia-500/[0.03]', dot: 'bg-fuchsia-400', badge: 'bg-fuchsia-500/15 text-fuchsia-300' },
    { header: 'from-violet-500/15 to-violet-500/[0.03]', dot: 'bg-violet-400', badge: 'bg-violet-500/15 text-violet-300' },
    { header: 'from-indigo-500/15 to-indigo-500/[0.03]', dot: 'bg-indigo-400', badge: 'bg-indigo-500/15 text-indigo-300' },
    { header: 'from-pink-500/15 to-pink-500/[0.03]', dot: 'bg-pink-400', badge: 'bg-pink-500/15 text-pink-300' },
    { header: 'from-rose-500/15 to-rose-500/[0.03]', dot: 'bg-rose-400', badge: 'bg-rose-500/15 text-rose-300' },
  ]

  const colorIdx = Math.abs(column.title.charCodeAt(0)) % accentColors.length
  const accent = accentColors[colorIdx]

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={`
        flex flex-col w-[330px] shrink-0 rounded-2xl border
        ${isDragging
          ? 'opacity-60 scale-[0.98] shadow-2xl shadow-purple-500/10 border-purple-500/20'
          : 'bg-white/[0.02] border-white/[0.07] hover:border-white/[0.1]'
        }
      `}
    >
      {/* Column header */}
      <div className={`p-4 rounded-t-2xl bg-gradient-to-b ${accent.header}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              {...attributes}
              {...listeners}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing hover:bg-white/[0.06]"
              aria-label="Arrastar coluna"
            >
              <GripVertical className="w-4 h-4" />
            </button>

            <div className={`w-2.5 h-2.5 rounded-full ${accent.dot} ring-2 ring-white/5`} />

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
                  className="h-7 w-32 text-sm font-semibold bg-white/[0.06] border-white/[0.12] text-white rounded-lg"
                />
                <button onClick={handleSaveTitle} className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => { setIsEditingTitle(false); setEditTitle(column.title) }} className="p-1 text-slate-500 hover:text-slate-300 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <h3 className="text-sm font-semibold text-white tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>
                {column.title}
              </h3>
            )}

            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${accent.badge}`}>
              {column.tasks.length}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] cursor-pointer outline-none">
                <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#12131a] border-white/[0.1] shadow-xl shadow-black/40">
              <DropdownMenuItem onClick={() => setIsEditingTitle(true)} className="text-slate-300 focus:text-white focus:bg-white/[0.06] cursor-pointer">
                <Pencil className="w-4 h-4 mr-2" /> Renomear
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteColumn.mutate(column.id)} className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer">
                <Trash2 className="w-4 h-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tasks list */}
      <div ref={setDroppableRef} className="flex-1 p-3 space-y-2.5 min-h-[80px] overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <MentoriaTaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {column.tasks.length === 0 && !isAddingTask && (
          <div className="flex items-center justify-center h-20 text-slate-600 text-sm">
            Nenhum cliente
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
                if (e.key === 'Escape') { setIsAddingTask(false); setNewTaskTitle(''); setNewTaskLogo(null); setNewTaskDueDate(''); setNewTaskMeetings('') }
              }}
              placeholder="Nome do cliente..."
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

            {/* Contract end date */}
            <div>
              <label className="text-[11px] text-slate-500 font-medium mb-1 block">Encerramento do contrato</label>
              <Input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                className="bg-white/[0.04] border-white/[0.1] text-white [color-scheme:dark] text-sm rounded-xl h-9"
              />
            </div>

            {/* Meetings count */}
            <div>
              <label className="text-[11px] text-slate-500 font-medium mb-1 block">Quantidade de reuniões feitas</label>
              <Input
                type="number"
                min="0"
                value={newTaskMeetings}
                onChange={(e) => setNewTaskMeetings(e.target.value)}
                placeholder="0"
                className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 text-sm rounded-xl h-9"
              />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddTask}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs cursor-pointer rounded-lg"
              >
                Adicionar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setIsAddingTask(false); setNewTaskTitle(''); setNewTaskLogo(null); setNewTaskDueDate(''); setNewTaskMeetings('') }}
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
            Novo cliente
          </button>
        )}
      </div>
    </div>
  )
}
