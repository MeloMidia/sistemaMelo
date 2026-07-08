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
      ref={setNodeRef}
      className="flex flex-col w-[290px] shrink-0 rounded-2xl transition-all duration-300 backdrop-blur-xl"
      style={{
        backgroundColor: isOver ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.01)',
        border: `1px solid ${isOver ? `${stage.color}40` : 'rgba(255,255,255,0.05)'}`,
        boxShadow: isOver ? `0 0 24px ${stage.color}0a` : '0 8px 32px rgba(0,0,0,0.15)',
      }}
    >
      {/* Cabeçalho */}
      <div className="px-4 pt-4 pb-3 shrink-0 border-b border-white/[0.03] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
               style={{
                 backgroundColor: `${stage.color}10`,
                 borderColor: `${stage.color}25`,
                 color: stage.color,
               }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: stage.color }} />
            <span>{stage.name}</span>
            <span className="opacity-60 text-[10px] font-bold ml-1 bg-white/10 px-1 py-0.5 rounded-md leading-none">
              {stage._count.leads > stage.leads.length
                ? `${stage.leads.length} de ${stage._count.leads}`
                : stage._count.leads}
            </span>
          </div>
        </div>
        {totalValue > 0 && (
          <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md tabular-nums">
            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        )}
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
