'use client'

import { useState, useRef, useEffect } from 'react'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import type { LeadStage } from '@/types/crm'
import { LeadCard } from './lead-card'
import { GripVertical, ArrowRightLeft, Pencil, Check, X, Palette } from 'lucide-react'
import { useUpdateStage } from '@/hooks/crm-api'

const PRESET_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#94a3b8', // slate
  '#e2e8f0', // light
]

interface LeadColumnProps {
  stage: LeadStage
  onSelectLead: (id: string) => void
  otherStages: Array<{ id: string; name: string; color: string }>
  onMoveAll: (toStageId: string) => void
  isMovingAll?: boolean
}

export function LeadColumn({ stage, onSelectLead, otherStages, onMoveAll, isMovingAll }: LeadColumnProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(stage.name)
  const [editColor, setEditColor] = useState(stage.color)
  const menuRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const updateStage = useUpdateStage()

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `stage-droppable-${stage.id}`,
    data: { stageId: stage.id },
  })

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `col-drag-${stage.id}`,
    data: { type: 'column', stageId: stage.id },
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMoveMenu(false)
      }
    }
    if (showMoveMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMoveMenu])

  useEffect(() => {
    if (isEditing) {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }
  }, [isEditing])

  function startEdit() {
    setEditName(stage.name)
    setEditColor(stage.color)
    setIsEditing(true)
    setShowMoveMenu(false)
  }

  function cancelEdit() {
    setIsEditing(false)
    setEditName(stage.name)
    setEditColor(stage.color)
  }

  function saveEdit() {
    const name = editName.trim()
    if (!name) return
    updateStage.mutate(
      { id: stage.id, name, color: editColor },
      { onSuccess: () => setIsEditing(false) }
    )
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  const totalValue = stage.leads.reduce((sum, l) => sum + (l.value ?? 0), 0)

  return (
    <div
      className={`flex flex-col w-[285px] shrink-0 rounded-2xl transition-all duration-200 ${isDragging ? 'opacity-30' : ''}`}
      style={{
        background: 'var(--nm-bg)',
        border: `1px solid ${isOver ? `${stage.color}50` : 'var(--nm-border)'}`,
        boxShadow: isOver
          ? `-8px -8px 18px var(--nm-light), 8px 8px 18px var(--nm-dark), 0 0 0 2px ${stage.color}40`
          : '-5px -5px 14px var(--nm-light), 5px 5px 14px var(--nm-dark)',
      }}
    >
      {/* Cabeçalho */}
      <div className="px-3 pt-4 pb-3 shrink-0" style={{ borderBottom: '1px solid var(--nm-border)' }}>
        {isEditing ? (
          /* ── Modo edição ── */
          <div className="flex flex-col gap-2.5">
            {/* Input de nome */}
            <input
              ref={nameInputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={40}
              className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-slate-600 outline-none focus:border-white/25 transition-colors"
              placeholder="Nome da etapa"
            />

            {/* Swatches de cor */}
            <div className="flex items-center gap-2">
              <label
                className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.05] text-white/70"
                title="Escolher cor"
              >
                <Palette className="h-3.5 w-3.5" />
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Escolher cor da etapa"
                />
              </label>
              <div className="grid flex-1 grid-cols-8 gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    title={c}
                    className="h-6 rounded-md transition-transform hover:scale-110 cursor-pointer"
                    style={{
                      backgroundColor: c,
                      outline: editColor === c ? `2px solid ${c}` : '2px solid transparent',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Confirmar / Cancelar */}
            <div className="flex gap-1.5">
              <button
                onClick={saveEdit}
                disabled={updateStage.isPending || !editName.trim()}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-white/[0.08] hover:bg-white/[0.14] text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {updateStage.isPending ? (
                  <div className="w-3 h-3 border border-white/50 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Salvar
              </button>
              <button
                onClick={cancelEdit}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          /* ── Modo normal ── */
          <div className="flex items-center gap-2">
            {/* Grip handle para arrastar coluna */}
            <div
              ref={setDragRef}
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-500 transition-colors shrink-0 touch-none"
              title="Arrastar coluna"
            >
              <GripVertical className="w-4 h-4" />
            </div>

            {/* Badge nome + contagem */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border flex-1 min-w-0"
              style={{
                backgroundColor: `${stage.color}10`,
                borderColor: `${stage.color}25`,
                color: stage.color,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: stage.color }} />
              <span className="truncate">{stage.name}</span>
              <span className="opacity-60 text-[10px] font-bold ml-1 bg-white/10 px-1 py-0.5 rounded-md leading-none shrink-0">
                {stage._count.leads > stage.leads.length
                  ? `${stage.leads.length} de ${stage._count.leads}`
                  : stage._count.leads}
              </span>
            </div>

            {/* Valor total */}
            {totalValue > 0 && (
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md tabular-nums shrink-0">
                R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            )}

            {/* Botão editar */}
            <button
              onClick={startEdit}
              title="Editar cor do título"
              className="flex h-6 w-6 items-center justify-center rounded-md border transition-all cursor-pointer shrink-0"
              style={{
                backgroundColor: `${stage.color}12`,
                borderColor: `${stage.color}35`,
                color: stage.color,
              }}
            >
              <Palette className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={startEdit}
              title="Editar nome e cor"
              className="p-1 rounded-md text-slate-700 hover:text-slate-300 hover:bg-white/[0.06] transition-all cursor-pointer shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            {/* Botão mover todos */}
            {otherStages.length > 0 && (
              <div className="relative shrink-0" ref={menuRef}>
                <button
                  onClick={() => setShowMoveMenu(!showMoveMenu)}
                  disabled={isMovingAll || stage._count.leads === 0}
                  title="Mover todos os leads"
                  className="p-1 rounded-md text-slate-700 hover:text-slate-300 hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isMovingAll ? (
                    <div className="w-3.5 h-3.5 border border-slate-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  )}
                </button>

                {showMoveMenu && (
                  <div
                    className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl overflow-hidden"
                    style={{ background: 'var(--nm-bg)', boxShadow: '-8px -8px 20px var(--nm-light), 8px 8px 20px var(--nm-dark)', border: '1px solid var(--nm-border)' }}
                  >
                    <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--nm-border)' }}>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Mover {stage._count.leads} leads para…
                      </span>
                    </div>
                    {otherStages.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          onMoveAll(s.id)
                          setShowMoveMenu(false)
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-white transition-colors cursor-pointer text-left"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista de leads */}
      <div
        ref={setDropRef}
        className="flex-1 px-3 pb-3 space-y-2 min-h-[60px] overflow-y-auto max-h-[calc(100vh-300px)]"
      >
        {stage.leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onSelect={() => onSelectLead(lead.id)} />
        ))}

        {stage.leads.length === 0 && (
          <div className="flex items-center justify-center h-16 text-slate-700 text-xs font-medium">
            Solte um lead aqui
          </div>
        )}
      </div>
    </div>
  )
}
