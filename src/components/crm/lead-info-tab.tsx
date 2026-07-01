'use client'

import { useEffect, useState } from 'react'
import { Tag as TagIcon, Plus, Copy, Check, X, Calendar } from 'lucide-react'
import {
  useCrmTags,
  useCreateCrmTag,
  useAttachTag,
  useDetachTag,

  useUpdateLead,
} from '@/hooks/crm-api'
import type { Lead, LeadStage } from '@/types/crm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getLeadDisplayName, formatPhoneNumber } from '@/lib/phone'
import { useEventCategories } from '@/hooks/agenda-api'
import { EventModal } from '@/components/agenda/event-modal'

interface LeadInfoTabProps {
  lead: Lead
  stage: Pick<LeadStage, 'name' | 'color'>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function LeadInfoTab({ lead, stage }: LeadInfoTabProps) {
  const { data: tags } = useCrmTags()
  const createTag = useCreateCrmTag()
  const attachTag = useAttachTag(lead.id)
  const detachTag = useDetachTag(lead.id)
  const updateLead = useUpdateLead()
  const { data: eventCategories } = useEventCategories()

  const [isAddingTag, setIsAddingTag] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')
  const [valueDraft, setValueDraft] = useState(lead.value?.toString() ?? '')
  const [copied, setCopied] = useState(false)

  const attachedTagIds = new Set(lead.tags.map((lt) => lt.tagId))

  useEffect(() => {
    setValueDraft(lead.value?.toString() ?? '')
  }, [lead.value])

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

  function handleValueBlur() {
    if (valueDraft.trim() === '') {
      if (lead.value !== null) updateLead.mutate({ id: lead.id, value: null })
      return
    }
    const parsed = parseFloat(valueDraft)
    if (Number.isNaN(parsed)) {
      setValueDraft(lead.value?.toString() ?? '')
      return
    }
    if (parsed !== lead.value) {
      updateLead.mutate({ id: lead.id, value: parsed })
    }
  }

  function handleCopyPhone() {
    navigator.clipboard.writeText(lead.phone)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="grid grid-cols-[110px_1fr] gap-y-3 text-sm items-center">
        <span className="text-slate-500">Criado em</span>
        <span className="text-white">{formatDate(lead.createdAt)}</span>

        <span className="text-slate-500">Estágio</span>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit"
          style={{ backgroundColor: `${stage.color}26`, color: stage.color }}
        >
          {stage.name}
        </span>

        <span className="text-slate-500">Contato</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-white truncate">{getLeadDisplayName(lead)}</span>
          <span className="text-slate-500 text-xs shrink-0">{formatPhoneNumber(lead.phone)}</span>
          <button onClick={handleCopyPhone} className="text-slate-500 hover:text-white cursor-pointer shrink-0">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <span className="text-slate-500">Termômetro</span>
        <div className="flex items-center gap-2">
          {['🟢', '🟡', '🔴'].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => updateLead.mutate({ id: lead.id, temperature: lead.temperature === emoji ? null : emoji })}
              className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all duration-200 cursor-pointer ${
                lead.temperature === emoji
                  ? 'bg-white/[0.08] border-white/20 scale-110 shadow-md font-bold'
                  : 'bg-transparent border-transparent hover:bg-white/[0.04] opacity-40 hover:opacity-100'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <span className="text-slate-500">Valor</span>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">R$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={valueDraft}
            onChange={(e) => setValueDraft(e.target.value)}
            onBlur={handleValueBlur}
            placeholder="—"
            className="bg-transparent text-white outline-none w-full border-b border-transparent focus:border-blue-500/50"
          />
        </div>

        <span className="text-slate-500">Touchpoints</span>
        <span className="text-white">{lead._count.messages}</span>
      </div>

      <Button
        onClick={() => setIsScheduling(true)}
        className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(249,115,22,0.2)] hover:shadow-[0_4px_20px_rgba(249,115,22,0.35)] active:scale-95 transition-all duration-200 cursor-pointer mt-1 mb-3"
      >
        <Calendar className="w-4 h-4" />
        Agendar Reunião
      </Button>

      {isScheduling && (
        <EventModal
          mode="create"
          initialDate={new Date()}
          initialHour={9}
          initialTitle={`Reunião: ${getLeadDisplayName(lead)}`}
          initialLeadId={lead.id}
          initialCategoryId={
            eventCategories?.find(c => c.name.toLowerCase().includes('agendada'))?.id
            ?? eventCategories?.[0]?.id
          }
          onClose={() => setIsScheduling(false)}
        />
      )}

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
  )
}
