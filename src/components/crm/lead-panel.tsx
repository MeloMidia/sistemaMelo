// src/components/crm/lead-panel.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Send, Tag as TagIcon, Plus } from 'lucide-react'
import {
  useLeadMessages,
  useSendMessage,
  useCrmTags,
  useCreateCrmTag,
  useAttachTag,
  useDetachTag,
  useCrmUsers,
  useUpdateLead,
  useStages,
} from '@/hooks/crm-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface LeadPanelProps {
  leadId: string
  onClose: () => void
}

export function LeadPanel({ leadId, onClose }: LeadPanelProps) {
  const { data: stages } = useStages()
  const lead = stages?.flatMap((s) => s.leads).find((l) => l.id === leadId)

  const { data: messages } = useLeadMessages(leadId)
  const sendMessage = useSendMessage(leadId)
  const { data: tags } = useCrmTags()
  const createTag = useCreateCrmTag()
  const attachTag = useAttachTag(leadId)
  const detachTag = useDetachTag(leadId)
  const { data: users } = useCrmUsers()
  const updateLead = useUpdateLead()

  const [draft, setDraft] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    if (!draft.trim() || sendMessage.isPending) return
    sendMessage.mutate(draft.trim())
    setDraft('')
  }

  function handleCreateTag() {
    if (!newTagName.trim()) return
    createTag.mutate(
      { name: newTagName.trim(), color: newTagColor },
      {
        onSuccess: (tag) => {
          attachTag.mutate(tag.id)
          setNewTagName('')
          setIsAddingTag(false)
        },
      }
    )
  }

  if (!lead) return null

  const attachedTagIds = new Set(lead.tags.map((lt) => lt.tagId))

  return (
    <div className="fixed top-[60px] bottom-0 right-0 w-[420px] bg-[#0a0b10] border-l border-white/[0.08] shadow-2xl shadow-black/40 flex flex-col z-40">
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <div>
          <h2 className="text-sm font-semibold text-white">{lead.name || lead.phone}</h2>
          <p className="text-xs text-slate-500">{lead.phone}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 border-b border-white/[0.06] space-y-3">
        <div>
          <label className="text-[11px] text-slate-500 font-medium mb-1 block">Responsável</label>
          <select
            value={lead.assignedToId ?? ''}
            onChange={(e) => updateLead.mutate({ id: lead.id, assignedToId: e.target.value || null })}
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
          >
            <option value="" className="bg-[#0a0b10]">Sem responsável</option>
            {(users || []).map((u) => (
              <option key={u.id} value={u.id} className="bg-[#0a0b10]">
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-500 font-medium mb-1 block">Tags</label>
          <div className="flex flex-wrap gap-1.5">
            {lead.tags.map((lt) => (
              <button
                key={lt.tagId}
                onClick={() => detachTag.mutate(lt.tagId)}
                className="text-[11px] font-medium px-2 py-1 rounded-full flex items-center gap-1"
                style={{ backgroundColor: `${lt.tag.color}26`, color: lt.tag.color }}
              >
                {lt.tag.name}
                <X className="w-3 h-3" />
              </button>
            ))}

            {!isAddingTag && (
              <button
                onClick={() => setIsAddingTag(true)}
                className="text-[11px] font-medium px-2 py-1 rounded-full border border-dashed border-white/[0.15] text-slate-500 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Tag
              </button>
            )}
          </div>

          {isAddingTag && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {(tags || [])
                  .filter((t) => !attachedTagIds.has(t.id))
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        attachTag.mutate(t.id)
                        setIsAddingTag(false)
                      }}
                      className="text-[11px] font-medium px-2 py-1 rounded-full cursor-pointer"
                      style={{ backgroundColor: `${t.color}26`, color: t.color }}
                    >
                      {t.name}
                    </button>
                  ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-white/[0.1] bg-transparent cursor-pointer"
                />
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                  placeholder="Nova tag..."
                  className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 text-sm rounded-xl"
                />
                <Button
                  size="sm"
                  onClick={handleCreateTag}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs cursor-pointer rounded-lg"
                >
                  <TagIcon className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(messages || []).map((m) => (
          <div key={m.id} className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                m.direction === 'OUTBOUND'
                  ? m.status === 'FAILED'
                    ? 'bg-red-500/20 text-red-200'
                    : 'bg-blue-600 text-white'
                  : 'bg-white/[0.06] text-slate-200'
              }`}
            >
              {m.content}
              {m.status === 'FAILED' && <div className="text-[10px] text-red-300 mt-1">Falha ao enviar</div>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-white/[0.06] flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Digite uma mensagem..."
          className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 rounded-xl"
        />
        <Button
          onClick={handleSend}
          disabled={!draft.trim() || sendMessage.isPending}
          className="bg-blue-600 hover:bg-blue-500 text-white cursor-pointer rounded-lg disabled:opacity-50"
          size="icon"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
