// src/components/crm/lead-card.tsx
'use client'

import { useDraggable } from '@dnd-kit/core'
import type { Lead } from '@/types/crm'
import { MessageCircle } from 'lucide-react'
import { getLeadDisplayName } from '@/lib/phone'

interface LeadCardProps {
  lead: Lead
  onSelect?: () => void
  isOverlay?: boolean
}

export function LeadCard({ lead, onSelect, isOverlay = false }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: isOverlay,
  })

  const lastMessage = lead.messages[0]

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={isOverlay ? undefined : onSelect}
      className={`
        p-3 rounded-xl border select-none transition-all duration-150
        ${isOverlay
          ? 'bg-white/[0.06] border-white/[0.15] shadow-2xl shadow-black/50 scale-[1.02] cursor-grabbing'
          : isDragging
            ? 'opacity-25 border-dashed border-white/[0.1] bg-transparent cursor-grabbing'
            : 'bg-white/[0.03] border-white/[0.07] hover:border-white/[0.15] hover:bg-white/[0.05] cursor-pointer'
        }
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white truncate">{getLeadDisplayName(lead)}</span>
        {lead.temperature && <span className="text-[11px] shrink-0 select-none">{lead.temperature}</span>}
      </div>

      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
        <MessageCircle className="w-3 h-3 shrink-0" />
        <span className="truncate">{lastMessage?.content ?? 'Sem mensagens'}</span>
      </div>

      {lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {lead.tags.map((lt) => (
            <span
              key={lt.tagId}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${lt.tag.color}26`, color: lt.tag.color }}
            >
              {lt.tag.name}
            </span>
          ))}
        </div>
      )}

      {lead.assignedTo && <div className="mt-2 text-[11px] text-slate-500">{lead.assignedTo.name}</div>}
    </div>
  )
}
