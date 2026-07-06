'use client'

import { useState, useRef, useEffect } from 'react'
import type { Task as TaskType } from '@/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Trash2, Calendar, Star, Pencil, Check, X,
  ImagePlus, FileText, Save, NotebookPen, Plus
} from 'lucide-react'
import { useDeleteTask, useUpdateTask } from '@/hooks/api'
import { Input } from '@/components/ui/input'

interface TaskCardProps {
  task: TaskType
}

interface NoteItem {
  id: string;
  date: string;
  text: string;
}

function parseNotes(notesStr: string | null | undefined): NoteItem[] {
  if (!notesStr) return [];
  try {
    const parsed = JSON.parse(notesStr);
    if (Array.isArray(parsed)) return parsed;
    throw new Error('Not array');
  } catch (e) {
    return [{
      id: 'legacy-note',
      date: new Date().toISOString(),
      text: notesStr
    }];
  }
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

export function TaskCard({ task }: TaskCardProps) {
  // Card inline edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDueDate, setEditDueDate] = useState(
    toLocalDateString(task.dueDate)
  )
  const [editLogo, setEditLogo] = useState<string | null>(task.logoUrl)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Detail modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteNoteModalOpen, setDeleteNoteModalOpen] = useState<string | null>(null)
  const [notesList, setNotesList] = useState<NoteItem[]>([])
  const [newNoteText, setNewNoteText] = useState('')

  useEffect(() => {
    setNotesList(parseNotes(task.notes))
  }, [task.notes])

  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()

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
    updateTask.mutate({
      id: task.id,
      title: editTitle.trim(),
      dueDate: editDueDate ? parseDateLocal(editDueDate) : null,
      logoUrl: editLogo,
    } as any)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditTitle(task.title)
    setEditDueDate(toLocalDateString(task.dueDate))
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

  // ── Modal notes handler ────────────────────────────────
  const handleOpenModal = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('textarea')) return
    if (isEditing) return
    setNewNoteText('')
    setModalOpen(true)
  }

  const dueDate = task.dueDate ? new Date(task.dueDate) : null
  const isOverdue = dueDate && dueDate < new Date()

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
        style={style}
        onClick={handleOpenModal}
        className={`
          group relative p-3.5 rounded-xl border transition-all duration-300 backdrop-blur-sm
          ${isDragging
            ? 'opacity-40 scale-[1.01] shadow-2xl shadow-black/80 border-blue-500/30 bg-[#111320]'
            : 'bg-[#0a0b10]/40 border-white/[0.04] hover:bg-[#0f111a]/70 hover:border-white/[0.1] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:-translate-y-0.5'
          }
          ${task.isPriorityToday && !isDragging ? 'border-l-2 border-l-amber-500/80' : ''}
          ${!isEditing ? 'cursor-pointer' : ''}
        `}
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
                  {task.notes && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                      <NotebookPen className="w-3 h-3 shrink-0" />
                      Notas
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Action buttons — only in view mode */}
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
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative z-10 w-full max-w-lg bg-[#0f1117] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-4 p-6 border-b border-white/[0.06]">
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

            {/* Notes section */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <FileText className="w-4 h-4 text-indigo-400" />
                Anotações do cliente
              </div>

              {/* Add Note */}
              <div className="space-y-2">
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Nova anotação..."
                  rows={3}
                  className="w-full rounded-xl bg-white/[0.03] border border-white/[0.07] focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 text-white placeholder:text-slate-600 px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none transition-colors"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      if (!newNoteText.trim()) return;
                      const newNote = {
                        id: crypto.randomUUID(),
                        date: new Date().toISOString(),
                        text: newNoteText.trim()
                      };
                      const updated = [newNote, ...notesList];
                      setNotesList(updated);
                      setNewNoteText('');
                      updateTask.mutate({ id: task.id, notes: JSON.stringify(updated) } as any);
                    }}
                    disabled={!newNoteText.trim() || updateTask.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Anotação
                  </button>
                </div>
              </div>

              {/* List Notes */}
              <div className="space-y-3 mt-4 max-h-[40vh] overflow-y-auto pr-2">
                {notesList.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">Nenhuma anotação adicionada ainda.</p>
                ) : (
                  notesList.map(note => (
                    <div key={note.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(note.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={() => setDeleteNoteModalOpen(note.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                          title="Excluir anotação"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{note.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Confirmação de Exclusão ──────────────── */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteModalOpen(false)} />
          <div className="relative z-10 w-full max-w-sm bg-[#0f1117] border border-white/[0.08] rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
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

      {/* ── Modal de Confirmação de Exclusão de Anotação ──────────────── */}
      {deleteNoteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteNoteModalOpen(null)} />
          <div className="relative z-10 w-full max-w-sm bg-[#0f1117] border border-white/[0.08] rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">Excluir Anotação</h3>
            <p className="text-sm text-slate-400 mb-6">Tem certeza que deseja excluir esta anotação? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteNoteModalOpen(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const updated = notesList.filter(n => n.id !== deleteNoteModalOpen);
                  setNotesList(updated);
                  updateTask.mutate({ id: task.id, notes: JSON.stringify(updated) } as any);
                  setDeleteNoteModalOpen(null);
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
