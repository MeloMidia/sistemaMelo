// src/components/crm/lead-card.tsx
'use client'

import { useDraggable } from '@dnd-kit/core'
import type { Lead } from '@/types/crm'
import { MessageCircle } from 'lucide-react'

interface LeadCardProps {
  lead: Lead
  onSelect: () => void
}

export function LeadCard({ lead, onSelect }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const lastMessage = lead.messages[0]

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`
        p-3 rounded-xl border cursor-pointer
        ${isDragging
          ? 'opacity-60 scale-[0.98] shadow-2xl shadow-blue-500/10 border-blue-500/20 z-10'
          : 'bg-white/[0.03] border-white/[0.07] hover:border-white/[0.15] hover:bg-white/[0.05]'
        }
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white truncate">{lead.name || lead.phone}</span>
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
