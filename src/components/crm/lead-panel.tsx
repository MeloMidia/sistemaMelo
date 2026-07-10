'use client'

import { useState } from 'react'
import { X, Info as InfoIcon, MessageCircle } from 'lucide-react'
import { useStages, useFollowUp } from '@/hooks/crm-api'
import { LeadInfoTab } from './lead-info-tab'
import { LeadConversaTab } from './lead-conversa-tab'
import { getLeadDisplayName, formatPhoneNumber } from '@/lib/phone'

interface LeadPanelProps {
  leadId: string
  onClose: () => void
}

const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

function getAvatarColor(seed: string): string {
  const idx = Math.abs(seed.charCodeAt(0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

export function LeadPanel({ leadId, onClose }: LeadPanelProps) {
  const { data: stages } = useStages()
  const { data: followUpColumns } = useFollowUp()
  const [activeTab, setActiveTab] = useState<'info' | 'conversa'>('info')

  // Busca o lead nas stages primeiro
  const stageWithLead = stages?.find((s) => s.leads.some((l) => l.id === leadId))
  let lead = stageWithLead?.leads.find((l) => l.id === leadId)

  // Se não encontrou, busca no follow-up
  if (!lead && followUpColumns) {
    for (const col of followUpColumns) {
      const found = col.leads.find((l) => l.id === leadId)
      if (found) { lead = found; break }
    }
  }

  // Stage para exibição (nome/cor) — encontrado pelo stageId do lead
  const stage = lead
    ? (stageWithLead ?? stages?.find((s) => s.id === lead?.stageId))
    : null

  if (!lead || !stage) return null

  const displayName = getLeadDisplayName(lead)
  const initial = displayName.charAt(0).toUpperCase()
  const avatarColor = getAvatarColor(displayName)

  return (
    <div className="fixed top-[60px] bottom-0 right-0 w-[420px] bg-black/50 backdrop-blur-xl border-l border-white/[0.12] shadow-2xl shadow-black/60 flex flex-col z-40">
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          {lead.profilePicUrl ? (
            <img
              src={lead.profilePicUrl}
              alt={displayName}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const sibling = e.currentTarget.nextElementSibling as HTMLElement | null
                if (sibling) sibling.style.display = 'flex'
              }}
              className="w-9 h-9 rounded-full object-cover shrink-0"
            />
          ) : null}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
            style={{ backgroundColor: avatarColor, display: lead.profilePicUrl ? 'none' : undefined }}
          >
            {initial}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">{displayName}</h2>
            <p className="text-xs text-slate-500">{formatPhoneNumber(lead.phone)}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-1 p-2 border-b border-white/[0.06]">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
            activeTab === 'info' ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-white'
          }`}
        >
          <InfoIcon className="w-3.5 h-3.5" /> Info
        </button>
        <button
          onClick={() => setActiveTab('conversa')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
            activeTab === 'conversa' ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-white'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" /> Conversa
        </button>
      </div>

      {activeTab === 'info' ? (
        <LeadInfoTab lead={lead} stage={stage} onClose={onClose} />
      ) : (
        <LeadConversaTab leadId={leadId} />
      )}
    </div>
  )
}
