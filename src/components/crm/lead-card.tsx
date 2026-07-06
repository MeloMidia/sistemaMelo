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

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={isOverlay ? undefined : onSelect}
      className={`
        group rounded-xl border select-none transition-all duration-300 backdrop-blur-sm
        ${isOverlay
          ? 'bg-[#151824] border-white/20 shadow-2xl shadow-black/80 scale-[1.01] cursor-grabbing'
          : isDragging
            ? 'opacity-20 border-dashed border-white/10 bg-transparent cursor-grabbing'
            : 'bg-[#0a0b10]/40 border-white/[0.04] hover:border-white/[0.1] hover:bg-[#0f111a]/70 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:-translate-y-0.5 cursor-pointer shadow-sm'
        }
      `}
    >
      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          {/* Avatar com anel de temperatura */}
          <div
            className="w-9 h-9 rounded-full shrink-0 p-[2px] mt-0.5 transition-transform duration-300 group-hover:scale-105"
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
              <span className="text-[13px] font-semibold text-white leading-tight truncate group-hover:text-green-400 transition-colors">
                {displayName}
              </span>
              {lastMessage?.createdAt && (
                <span className="text-[10px] text-slate-500 shrink-0 tabular-nums font-medium">
                  {timeAgo(lastMessage.createdAt)}
                </span>
              )}
            </div>

            <p className="text-[11.5px] text-slate-400 truncate mt-1.5 leading-snug">
              {lastMessage?.content ?? 'Sem mensagens'}
            </p>
          </div>
        </div>

        {/* Rodapé: tags e valor */}
        {(lead.tags.length > 0 || (lead.value !== null && lead.value > 0)) && (
          <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-white/[0.03]">
            {/* Tags */}
            <div className="flex flex-wrap gap-1 min-w-0">
              {lead.tags.slice(0, 2).map((lt) => (
                <span
                  key={lt.tagId}
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md truncate max-w-[85px]"
                  style={{
                    backgroundColor: `${lt.tag.color}15`,
                    color: lt.tag.color,
                    border: `1px solid ${lt.tag.color}25`,
                  }}
                >
                  {lt.tag.name}
                </span>
              ))}
              {lead.tags.length > 2 && (
                <span className="text-[9px] text-slate-500 font-bold bg-white/[0.04] px-1.5 py-0.5 rounded-md shrink-0">+{lead.tags.length - 2}</span>
              )}
            </div>

            {/* Valor */}
            {lead.value !== null && lead.value > 0 && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-md shrink-0 tabular-nums">
                R$ {lead.value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
