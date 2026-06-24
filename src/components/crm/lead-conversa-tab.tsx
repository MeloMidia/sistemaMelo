'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { useLeadMessages, useSendMessage } from '@/hooks/crm-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface LeadConversaTabProps {
  leadId: string
}

export function LeadConversaTab({ leadId }: LeadConversaTabProps) {
  const { data: messages } = useLeadMessages(leadId)
  const sendMessage = useSendMessage(leadId)
  const [draft, setDraft] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    if (!draft.trim() || sendMessage.isPending) return
    sendMessage.mutate(draft.trim())
    setDraft('')
  }

  return (
    <div className="flex-1 flex flex-col">
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
