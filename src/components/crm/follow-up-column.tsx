'use client'

import { useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { ArrowRightLeft } from 'lucide-react'
import type { Lead } from '@/types/crm'
import { LeadCard } from './lead-card'

function sinceLabel(dateStr: string | null): string | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins || 1}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

export const FOLLOW_UP_COLORS = [
  '#ef4444', // 1 - vermelho
  '#f97316', // 2 - laranja
  '#f59e0b', // 3 - âmbar
  '#eab308', // 4 - amarelo
  '#84cc16', // 5 - lime
  '#22c55e', // 6 - verde
  '#10b981', // 7 - esmeralda
  '#14b8a6', // 8 - teal
  '#06b6d4', // 9 - ciano
  '#0ea5e9', // 10 - sky
  '#3b82f6', // 11 - azul
  '#6366f1', // 12 - índigo
  '#8b5cf6', // 13 - violeta
  '#a855f7', // 14 - roxo
]

interface OtherColumn {
  column: number
  color: string
}

interface FollowUpColumnProps {
  column: number
  leads: Lead[]
  totalCount: number
  onSelectLead: (id: string) => void
  otherColumns?: OtherColumn[]
  onMoveAll?: (toColumn: number) => void
  isMovingAll?: boolean
}

export function FollowUpColumn({
  column,
  leads,
  totalCount,
  onSelectLead,
  otherColumns = [],
  onMoveAll,
  isMovingAll,
}: FollowUpColumnProps) {
  const color = FOLLOW_UP_COLORS[column - 1]
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { setNodeRef, isOver } = useDroppable({
    id: `followup-droppable-${column}`,
    data: { column, type: 'follow-up-column' },
  })

  const totalValue = leads.reduce((sum, l) => sum + (l.value ?? 0), 0)

  return (
    <div
      className="flex flex-col w-[260px] shrink-0 rounded-2xl transition-all duration-300 backdrop-blur-xl"
      style={{
        backgroundColor: isOver ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.01)',
        border: `1px solid ${isOver ? `${color}40` : 'rgba(255,255,255,0.05)'}`,
        boxShadow: isOver ? `0 0 24px ${color}0a` : '0 8px 32px rgba(0,0,0,0.15)',
      }}
    >
      {/* Cabeçalho */}
      <div className="px-3 pt-4 pb-3 shrink-0 border-b border-white/[0.03] flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border flex-1 min-w-0"
          style={{
            backgroundColor: `${color}10`,
            borderColor: `${color}25`,
            color,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="truncate">Follow Up {column}</span>
          <span className="opacity-60 text-[10px] font-bold ml-1 bg-white/10 px-1 py-0.5 rounded-md leading-none shrink-0">
            {totalCount}
          </span>
        </div>

        {totalValue > 0 && (
          <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md tabular-nums shrink-0">
            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        )}

        {/* Botão mover todos */}
        {onMoveAll && otherColumns.length > 0 && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setShowMoveMenu(!showMoveMenu)}
              disabled={isMovingAll || totalCount === 0}
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
              <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-[#0e1117] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden">
                <div className="px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Mover {totalCount} leads para…
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {otherColumns.map((col) => (
                    <button
                      key={col.column}
                      onClick={() => {
                        onMoveAll(col.column)
                        setShowMoveMenu(false)
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-white transition-colors cursor-pointer text-left"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                      <span className="truncate">Follow Up {col.column}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista de leads */}
      <div
        ref={setNodeRef}
        className="flex-1 px-3 pb-3 space-y-2 min-h-[60px] overflow-y-auto max-h-[calc(100vh-300px)]"
      >
        {leads.map((lead) => {
          const since = sinceLabel(lead.followUpMovedAt)
          const lastMsg = lead.messages?.[0]
          const msgTime = lastMsg?.createdAt ? sinceLabel(lastMsg.createdAt) : null
          return (
            <div key={lead.id}>
              <LeadCard lead={lead} onSelect={() => onSelectLead(lead.id)} disableTimestamp />
              <div className="flex items-center justify-between px-1 mt-0.5 mb-0.5">
                {msgTime ? (
                  <span className="text-[9px] text-slate-500 tabular-nums">
                    última msg: {msgTime}
                  </span>
                ) : <span />}
                {since && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}30` }}
                  >
                    {since} nessa col.
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {leads.length === 0 && (
          <div className="flex items-center justify-center h-16 text-slate-700 text-xs font-medium">
            Solte um lead aqui
          </div>
        )}
      </div>
    </div>
  )
}
