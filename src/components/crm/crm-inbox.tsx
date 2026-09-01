'use client'

import { useDeferredValue, useState, type CSSProperties } from 'react'
import { CheckCheck, MessageCircle, Search, Wifi, WifiOff, X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrmConversation } from '@/types/crm'
import { formatPhoneNumber, getLeadDisplayName } from '@/lib/phone'
import { useConnection, useCrmStream } from '@/hooks/crm-api'
import { LeadConversaTab } from './lead-conversa-tab'
import { LeadNotesTab } from './lead-notes-tab'
import { LeadLogsTab } from './lead-logs-tab'
import { LeadProfilePanel } from './lead-profile-panel'
import { KanbanLeads } from './kanban-leads'

type Filter = 'all' | 'unread'
export type CrmView = 'inbox' | 'pipeline'
type ChatTab = 'logs' | 'notes' | 'chat'

function formatConversationTime(value: string) {
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
  }
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)
}

function preview(content: string) {
  if (content.startsWith('[midia')) return 'Mídia recebida'
  if (content.startsWith('[Nota Interna]')) return 'Nota interna'
  return content
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

function Avatar({ conversation, size = 'md' }: { conversation: CrmConversation; size?: 'sm' | 'md' }) {
  const displayName = getLeadDisplayName(conversation)
  const dimension = size === 'sm' ? 'size-9 text-xs' : 'size-10 text-sm'

  if (conversation.profilePicUrl) {
    const pixels = size === 'sm' ? 36 : 40
    // External WhatsApp avatar URLs are not stable enough for next/image optimization.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={conversation.profilePicUrl} alt="" width={pixels} height={pixels} className={`${dimension} mf-conversation-avatar rounded-full object-cover shrink-0`} />
  }

  return (
    <div className={`${dimension} mf-conversation-avatar rounded-full shrink-0 flex items-center justify-center font-semibold`}>
      {displayName.slice(0, 1).toUpperCase()}
    </div>
  )
}

export function CrmInbox({
  openLeadId,
  view: controlledView,
  onViewChange,
}: {
  openLeadId?: string | null
  view?: CrmView
  onViewChange?: (view: CrmView) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(openLeadId ?? null)
  const [chatTab, setChatTab] = useState<ChatTab>('chat')
  const [chatTabSelectedId, setChatTabSelectedId] = useState<string | null>(selectedId)
  const [localView, setLocalView] = useState<CrmView>('inbox')
  const view = controlledView ?? localView
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const queryClient = useQueryClient()
  const { data: connection } = useConnection()
  useCrmStream()

  const conversationsQuery = useQuery<CrmConversation[]>({
    queryKey: ['crm-conversations', deferredSearch],
    queryFn: async () => {
      const query = deferredSearch ? `?q=${encodeURIComponent(deferredSearch)}` : ''
      const response = await fetch(`/api/crm/conversations${query}`)
      if (!response.ok) throw new Error('Não foi possível carregar as conversas.')
      return response.json()
    },
    refetchInterval: 15_000,
  })

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/crm/conversations/${id}/read`, { method: 'POST' })
      if (!response.ok) throw new Error('Não foi possível atualizar a leitura.')
      return response.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-conversations'] }),
  })

  const conversations = conversationsQuery.data ?? []
  const visibleConversations = (() => {
    const term = normalizeSearch(search.trim())
    const phoneTerm = search.replace(/\D/g, '')
    return conversations.filter((conversation) => {
      if (filter === 'unread' && !conversation.isUnread) return false
      if (!term) return true
      const searchableContent = [
        conversation.name,
        getLeadDisplayName(conversation),
        conversation.phone,
        formatPhoneNumber(conversation.phone),
        ...(conversation.tags ?? []).map(({ tag }) => tag.name),
        conversation.lastMessage?.content,
      ].filter(Boolean).join(' ')

      return normalizeSearch(searchableContent).includes(term) ||
        Boolean(phoneTerm && conversation.phone.replace(/\D/g, '').includes(phoneTerm))
    })
  })()

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null
  const unreadCount = conversations.filter((conversation) => conversation.isUnread).length

  // Volta pra aba "Chat" ao trocar de conversa, sem usar efeito (ajuste de estado
  // durante a renderização — ver https://react.dev/learn/you-might-not-need-an-effect).
  if (selectedId !== chatTabSelectedId) {
    setChatTabSelectedId(selectedId)
    setChatTab('chat')
  }

  function selectConversation(conversation: CrmConversation) {
    setSelectedId(conversation.id)
    if (conversation.isUnread) markAsRead.mutate(conversation.id)
  }

  function setView(nextView: CrmView) {
    setLocalView(nextView)
    onViewChange?.(nextView)
  }

  function openLeadFromPipeline(leadId: string) {
    setSelectedId(leadId)
    setView('inbox')
  }

  if (view === 'pipeline') {
    return <KanbanLeads onOpenLead={openLeadFromPipeline} onOpenInbox={() => setView('inbox')} />
  }

  return (
    <div className="mf-inbox flex-1 min-h-0 flex overflow-hidden">
      <aside className={`mf-inbox-rail w-full md:w-[360px] shrink-0 min-h-0 flex flex-col border-r ${selected ? 'hidden md:flex' : 'flex'}`}>
        <div className="mf-inbox-heading px-5 pt-5 pb-4 border-b">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="mf-eyebrow mb-1">Inbox comercial</p>
              <h1 className="text-xl text-[#151817] font-semibold tracking-tight">Conversas</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-[11px] font-medium ${connection?.status === 'open' ? 'text-[#16805D]' : 'text-slate-500'}`}>
                {connection?.status === 'open' ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
                {connection?.status === 'open' ? 'Conectado' : 'Desconectado'}
              </div>
            </div>
          </div>

          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, telefone ou mensagem..."
              className="mf-inbox-search w-full h-10 pl-9 pr-9 rounded-xl border text-sm outline-none focus:border-[#2854DF] focus:ring-2 focus:ring-[#2854DF]/10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Limpar pesquisa"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </label>

          <div className="mf-inbox-filter grid grid-cols-2 gap-1 mt-3 rounded-lg p-1">
            <button onClick={() => setFilter('all')} className={`h-7 rounded-md text-xs font-medium transition-colors ${filter === 'all' ? 'mf-inbox-filter-active' : 'text-slate-500 hover:text-[#151817]'}`}>Todas</button>
            <button onClick={() => setFilter('unread')} className={`h-7 rounded-md text-xs font-medium transition-colors ${filter === 'unread' ? 'mf-inbox-filter-active' : 'text-slate-500 hover:text-[#151817]'}`}>
              Não lidas{unreadCount ? ` (${unreadCount})` : ''}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversationsQuery.isLoading && <p className="p-6 text-sm text-slate-500">Carregando conversas...</p>}
          {conversationsQuery.isError && <p className="p-6 text-sm text-red-400">Não foi possível carregar as conversas.</p>}
          {!conversationsQuery.isLoading && visibleConversations.length === 0 && (
            <div className="p-8 text-center">
              <MessageCircle className="size-8 mx-auto text-slate-700 mb-3" />
              <p className="text-sm text-slate-400">Nenhuma conversa encontrada</p>
              <p className="text-xs text-slate-600 mt-1">Novas mensagens do WhatsApp aparecerão aqui.</p>
            </div>
          )}
          {visibleConversations.map((conversation) => {
            const active = conversation.id === selectedId
            const lastMessage = conversation.lastMessage
            const visibleTags = conversation.tags?.slice(0, 2) ?? []
            const extraTagsCount = Math.max((conversation.tags?.length ?? 0) - visibleTags.length, 0)
            return (
              <button
                key={conversation.id}
                onClick={() => selectConversation(conversation)}
                className={`mf-inbox-row w-full flex gap-3 px-5 py-3.5 text-left border-b transition-colors ${active ? 'mf-inbox-row-active' : ''}`}
              >
                <Avatar conversation={conversation} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`mf-inbox-contact truncate text-sm ${conversation.isUnread ? 'font-semibold' : 'font-medium'}`}>{getLeadDisplayName(conversation)}</p>
                    {lastMessage && <time className={`ml-auto shrink-0 text-[10px] ${conversation.isUnread ? 'text-emerald-400' : 'text-slate-500'}`}>{formatConversationTime(lastMessage.createdAt)}</time>}
                  </div>
                  {visibleTags.length > 0 && (
                    <div className="mf-inbox-tag-row" aria-label={`Etiquetas: ${conversation.tags.map(({ tag }) => tag.name).join(', ')}`}>
                      {visibleTags.map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="mf-inbox-tag"
                          style={{ '--tag-color': tag.color } as CSSProperties}
                          title={tag.name}
                        >
                          <span aria-hidden="true" />
                          <span>{tag.name}</span>
                        </span>
                      ))}
                      {extraTagsCount > 0 && <strong>+{extraTagsCount}</strong>}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-1.5">
                    {lastMessage?.direction === 'OUTBOUND' && <CheckCheck className="size-3.5 shrink-0 text-sky-400" />}
                    <p className={`mf-inbox-preview min-w-0 flex-1 truncate text-xs ${conversation.isUnread ? 'font-medium' : ''}`}>{lastMessage ? preview(lastMessage.content) : 'Sem mensagens'}</p>
                    {conversation.isUnread && <span className="ml-auto size-2 rounded-full bg-emerald-400 shrink-0" />}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      <section className={`flex-1 min-w-0 min-h-0 flex flex-col ${selected ? 'flex' : 'hidden md:flex'}`}>
        {selected ? (
          <>
            <header className="mf-inbox-chat-header h-[73px] shrink-0 flex items-center gap-3 px-4 md:px-5 border-b">
              <button onClick={() => setSelectedId(null)} className="mf-inbox-back md:hidden text-sm">Voltar</button>
              <Avatar conversation={selected} size="sm" />
              <div className="min-w-0">
                <h2 className="mf-inbox-contact text-sm font-semibold truncate">{getLeadDisplayName(selected)}</h2>
                <p className="mf-inbox-phone text-xs truncate">{formatPhoneNumber(selected.phone)}</p>
              </div>
              <div className="mf-inbox-chat-tabs ml-auto hidden sm:flex items-center self-stretch">
                <button
                  type="button"
                  onClick={() => setChatTab('logs')}
                  className={chatTab === 'logs' ? 'is-active' : ''}
                  aria-current={chatTab === 'logs' ? 'page' : undefined}
                >
                  Logs
                </button>
                <button
                  type="button"
                  onClick={() => setChatTab('notes')}
                  className={chatTab === 'notes' ? 'is-active' : ''}
                  aria-current={chatTab === 'notes' ? 'page' : undefined}
                >
                  Anotações
                </button>
                <button
                  type="button"
                  onClick={() => setChatTab('chat')}
                  className={chatTab === 'chat' ? 'is-active' : ''}
                  aria-current={chatTab === 'chat' ? 'page' : undefined}
                >
                  Chat
                </button>
              </div>
            </header>
            {chatTab === 'chat' && <LeadConversaTab leadId={selected.id} />}
            {chatTab === 'notes' && <LeadNotesTab leadId={selected.id} />}
            {chatTab === 'logs' && <LeadLogsTab leadId={selected.id} />}
          </>
        ) : (
          <div className="mf-inbox-empty flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="size-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4"><MessageCircle className="size-7" /></div>
            <h2 className="text-base font-semibold text-white">Selecione uma conversa</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">As novas mensagens recebidas no WhatsApp aparecerão aqui em tempo real.</p>
          </div>
        )}
      </section>
      {selected && <LeadProfilePanel leadId={selected.id} />}
    </div>
  )
}
