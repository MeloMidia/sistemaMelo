// src/components/crm/lead-card.tsx
'use client'

import { useDraggable } from '@dnd-kit/core'
import type { Lead } from '@/types/crm'
import { MessageCircle } from 'lucide-react'
import { getLeadDisplayName } from '@/lib/phone'

const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']
function getAvatarColor(seed: string): string {
  return AVATAR_COLORS[Math.abs(seed.charCodeAt(0)) % AVATAR_COLORS.length]
}

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
  const displayName = getLeadDisplayName(lead)
  const initial = displayName.charAt(0).toUpperCase()
  const avatarColor = getAvatarColor(displayName)

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
      <div className="flex items-start gap-2.5">
        {/* Avatar: foto real quando disponível, inicial colorida como fallback */}
        {lead.profilePicUrl ? (
          <img
            src={lead.profilePicUrl}
            alt={displayName}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const sibling = e.currentTarget.nextElementSibling as HTMLElement | null
              if (sibling) sibling.style.display = 'flex'
            }}
            className="w-9 h-9 rounded-full object-cover shrink-0 mt-0.5"
          />
        ) : null}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0 mt-0.5"
          style={{ backgroundColor: avatarColor, display: lead.profilePicUrl ? 'none' : undefined }}
        >
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-sm font-medium text-white truncate">{displayName}</span>
            {lead.temperature && <span className="text-[11px] shrink-0 select-none">{lead.temperature}</span>}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
            <MessageCircle className="w-3 h-3 shrink-0" />
            <span className="truncate">{lastMessage?.content ?? 'Sem mensagens'}</span>
          </div>

          {lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
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

          {lead.assignedTo && <div className="mt-1 text-[11px] text-slate-500">{lead.assignedTo.name}</div>}
        </div>
      </div>
    </div>
  )
}
