'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Lead } from '@/types/crm'
import { getLeadDisplayName } from '@/lib/phone'

const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']
function getAvatarColor(seed: string): string {
  return AVATAR_COLORS[Math.abs(seed.charCodeAt(0)) % AVATAR_COLORS.length]
}

const TEMP_COLOR: Record<string, string> = {
  '🟢': '#10b981',
  '🟡': '#f59e0b',
  '🔴': '#ef4444',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

interface LeadCardProps {
  lead: Lead
  onSelect?: () => void
  isOverlay?: boolean
}

export function LeadCard({ lead, onSelect, isOverlay = false }: LeadCardProps) {
  const [imgError, setImgError] = useState(false)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: isOverlay,
  })

  const lastMessage = lead.messages[0]
  const displayName = getLeadDisplayName(lead)
  const initial = displayName.charAt(0).toUpperCase()
  const avatarColor = getAvatarColor(displayName)
  const tempColor = lead.temperature ? TEMP_COLOR[lead.temperature] : null
  const interactionLevel = Math.min(5, Math.ceil(lead._count.messages / 15))

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={isOverlay ? undefined : onSelect}
      className={`
        rounded-xl border select-none transition-all duration-150
        ${isOverlay
          ? 'bg-[#1c1f2e] border-white/20 shadow-2xl shadow-black/70 scale-[1.02] cursor-grabbing'
          : isDragging
            ? 'opacity-20 border-dashed border-white/10 bg-transparent cursor-grabbing'
            : 'bg-[#12141c] border-white/[0.07] hover:border-white/[0.18] hover:bg-[#141720] cursor-pointer shadow-sm hover:shadow-md hover:shadow-black/30'
        }
      `}
    >
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          {/* Avatar com anel de temperatura */}
          <div
            className="w-9 h-9 rounded-full shrink-0 p-[2px] mt-0.5"
            style={{
              background: tempColor
                ? `linear-gradient(135deg, ${tempColor}CC, ${tempColor}44)`
                : 'rgba(255,255,255,0.05)',
            }}
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-[#1a1d2a]">
              {lead.profilePicUrl && !imgError ? (
                <img
                  src={lead.profilePicUrl}
                  alt={displayName}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-[13px] font-bold text-white"
                  style={{ backgroundColor: avatarColor }}
                >
                  {initial}
                </div>
              )}
            </div>
          </div>

          {/* Conteúdo principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[13px] font-semibold text-white leading-tight truncate">
                {displayName}
              </span>
              {lastMessage?.createdAt && (
                <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                  {timeAgo(lastMessage.createdAt)}
                </span>
              )}
            </div>

            <p className="text-[11.5px] text-slate-500 truncate mt-0.5 leading-snug">
              {lastMessage?.content ?? 'Sem mensagens'}
            </p>
          </div>
        </div>

        {/* Rodapé: tags + dots de interação */}
        {(lead.tags.length > 0 || interactionLevel > 0) && (
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.04]">
            <div className="flex flex-wrap gap-1">
              {lead.tags.slice(0, 2).map((lt) => (
                <span
                  key={lt.tagId}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{
                    backgroundColor: `${lt.tag.color}18`,
                    color: lt.tag.color,
                    border: `1px solid ${lt.tag.color}30`,
                  }}
                >
                  {lt.tag.name}
                </span>
              ))}
              {lead.tags.length > 2 && (
                <span className="text-[10px] text-slate-600 px-0.5">+{lead.tags.length - 2}</span>
              )}
            </div>

            {/* Dots de nível de interação */}
            <div className="flex items-center gap-[3px] shrink-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full transition-colors"
                  style={{
                    backgroundColor: i < interactionLevel
                      ? (tempColor ?? '#6366f1')
                      : 'rgba(255,255,255,0.07)',
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
