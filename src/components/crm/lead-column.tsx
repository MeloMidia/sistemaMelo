'use client'

import { useDroppable } from '@dnd-kit/core'
import type { LeadStage } from '@/types/crm'
import { LeadCard } from './lead-card'

interface LeadColumnProps {
  stage: LeadStage
  onSelectLead: (id: string) => void
}

export function LeadColumn({ stage, onSelectLead }: LeadColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-droppable-${stage.id}`,
    data: { stageId: stage.id },
  })

  const totalValue = stage.leads.reduce((sum, l) => sum + (l.value ?? 0), 0)

  return (
    <div
      className="flex flex-col w-[290px] shrink-0 rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: '#0d0f18',
        border: `1px solid ${isOver ? `${stage.color}50` : 'rgba(255,255,255,0.06)'}`,
        boxShadow: isOver ? `0 0 24px ${stage.color}12, inset 0 0 24px ${stage.color}06` : 'none',
      }}
    >
      {/* Linha colorida no topo */}
      <div className="h-[3px] w-full shrink-0" style={{ backgroundColor: stage.color }} />

      {/* Cabeçalho */}
      <div className="px-4 pt-3.5 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[13px] font-bold text-white tracking-tight">{stage.name}</h3>
            <span
              className="text-[11px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
              style={{
                backgroundColor: `${stage.color}18`,
                color: stage.color,
                border: `1px solid ${stage.color}25`,
              }}
            >
              {stage.leads.length}
            </span>
          </div>
          {totalValue > 0 && (
            <span className="text-[11px] text-slate-400 font-semibold tabular-nums">
              R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
      </div>

      {/* Lista de leads */}
      <div
        ref={setNodeRef}
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
