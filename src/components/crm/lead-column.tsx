// src/components/crm/lead-column.tsx
'use client'

import { useDroppable } from '@dnd-kit/core'
import type { LeadStage } from '@/types/crm'
import { LeadCard } from './lead-card'

interface LeadColumnProps {
  stage: LeadStage
  onSelectLead: (id: string) => void
}

export function LeadColumn({ stage, onSelectLead }: LeadColumnProps) {
  const { setNodeRef } = useDroppable({
    id: `stage-droppable-${stage.id}`,
    data: { stageId: stage.id },
  })

  return (
    <div className="flex flex-col w-[330px] shrink-0 rounded-2xl border bg-white/[0.02] border-white/[0.07] hover:border-white/[0.1]">
      <div
        className="p-4 rounded-t-2xl"
        style={{ background: `linear-gradient(to bottom, ${stage.color}26, transparent)` }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white/5" style={{ backgroundColor: stage.color }} />
          <h3 className="text-sm font-semibold text-white tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>
            {stage.name}
          </h3>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-300">
            {stage.leads.length}
          </span>
        </div>
      </div>

      <div ref={setNodeRef} className="flex-1 p-3 space-y-2.5 min-h-[80px] overflow-y-auto max-h-[calc(100vh-280px)]">
        {stage.leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onSelect={() => onSelectLead(lead.id)} />
        ))}

        {stage.leads.length === 0 && (
          <div className="flex items-center justify-center h-20 text-slate-600 text-sm">Nenhum lead</div>
        )}
      </div>
    </div>
  )
}
