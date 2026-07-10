'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Lead } from '@/types/crm'
import { LeadCard } from './lead-card'

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

interface FollowUpColumnProps {
  column: number
  leads: Lead[]
  totalCount: number
  onSelectLead: (id: string) => void
}

export function FollowUpColumn({ column, leads, totalCount, onSelectLead }: FollowUpColumnProps) {
  const color = FOLLOW_UP_COLORS[column - 1]

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
      </div>

      {/* Lista de leads */}
      <div
        ref={setNodeRef}
        className="flex-1 px-3 pb-3 space-y-2 min-h-[60px] overflow-y-auto max-h-[calc(100vh-300px)]"
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onSelect={() => onSelectLead(lead.id)} />
        ))}

        {leads.length === 0 && (
          <div className="flex items-center justify-center h-16 text-slate-700 text-xs font-medium">
            Solte um lead aqui
          </div>
        )}
      </div>
    </div>
  )
}
