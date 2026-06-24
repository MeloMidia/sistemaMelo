// src/components/crm/lead-panel.tsx
'use client'

import { useState } from 'react'
import { X, Info as InfoIcon, MessageCircle } from 'lucide-react'
import { useStages } from '@/hooks/crm-api'
import { LeadInfoTab } from './lead-info-tab'
import { LeadConversaTab } from './lead-conversa-tab'

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
  const stage = stages?.find((s) => s.leads.some((l) => l.id === leadId))
  const lead = stage?.leads.find((l) => l.id === leadId)
  const [activeTab, setActiveTab] = useState<'info' | 'conversa'>('info')

  if (!lead || !stage) return null

  const initial = (lead.name || lead.phone).charAt(0).toUpperCase()
  const avatarColor = getAvatarColor(lead.name || lead.phone)

  return (
    <div className="fixed top-[60px] bottom-0 right-0 w-[420px] bg-[#0a0b10] border-l border-white/[0.08] shadow-2xl shadow-black/40 flex flex-col z-40">
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {initial}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">{lead.name || lead.phone}</h2>
            <p className="text-xs text-slate-500">{lead.phone}</p>
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

      {activeTab === 'info' ? <LeadInfoTab lead={lead} stage={stage} /> : <LeadConversaTab leadId={leadId} />}
    </div>
  )
}
