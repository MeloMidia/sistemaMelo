# Aba "Info" no Painel do Lead — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar o painel lateral do lead (CRM) em duas abas — Info e Conversa — com captura automática do nome do contato via WhatsApp, campo de Valor (R$) e contador de Touchpoints.

**Architecture:** Um campo novo no Prisma (`Lead.value`), captura de `pushName` no webhook na criação do lead, `_count.messages` adicionado nas queries de leitura existentes (sem novo endpoint), e o componente `lead-panel.tsx` dividido em uma casca (header + abas) + dois componentes de conteúdo (`lead-info-tab.tsx`, `lead-conversa-tab.tsx`).

**Tech Stack:** Next.js 16 App Router, Prisma 6, TypeScript, TanStack React Query, Tailwind, lucide-react.

**Referência de design:** `docs/superpowers/specs/2026-06-24-lead-info-tab-design.md`

---

## File Map

**Modify:**
- `prisma/schema.prisma` — adiciona `value Float?` em `Lead`
- `src/app/api/whatsapp/webhook/route.ts` — captura `pushName` na criação do lead
- `src/app/api/crm/leads/[id]/route.ts` — PUT aceita `value`; GET inclui `_count.messages`
- `src/app/api/crm/stages/route.ts` — GET inclui `_count.messages` nos leads
- `src/types/crm.ts` — `Lead` ganha `value` e `_count`
- `src/hooks/crm-api.ts` — `useUpdateLead` aceita `value`
- `src/components/crm/lead-panel.tsx` — reescrito como casca (header + abas)

**Create:**
- `src/components/crm/lead-info-tab.tsx`
- `src/components/crm/lead-conversa-tab.tsx`

**Nota sobre testes:** sem framework de testes automatizados neste projeto. Verificação via `npx tsc --noEmit`, `npx prisma db push`, e teste manual real no navegador (incluindo Playwright quando aplicável, conforme já usado na integração anterior).

---

## Task 1: Prisma Schema — Campo `value`

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar o campo no model `Lead`**

Em `prisma/schema.prisma`, dentro do `model Lead`, adicionar `value` depois de `assignedTo`:

```prisma
model Lead {
  id           String     @id @default(cuid())
  name         String?
  phone        String     @unique
  stageId      String
  stage        LeadStage  @relation(fields: [stageId], references: [id])
  assignedToId String?
  assignedTo   User?      @relation(fields: [assignedToId], references: [id])
  value        Float?
  messages     Message[]
  tags         LeadTag[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}
```

- [ ] **Step 2: Aplicar no banco**

Run: `npx prisma db push`
Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: adiciona campo value (valor do negocio) ao Lead"
```

---

## Task 2: Webhook — Captura do Nome via `pushName`

**Files:**
- Modify: `src/app/api/whatsapp/webhook/route.ts`

- [ ] **Step 1: Capturar `pushName` na criação do lead**

Em `handleMessagesUpsert`, localizar este trecho:

```typescript
  let lead = await prisma.lead.findUnique({ where: { phone } })
  if (!lead) {
    const firstStage = await prisma.leadStage.findFirst({ orderBy: { order: 'asc' } })
    if (!firstStage) return
    lead = await prisma.lead.create({ data: { phone, stageId: firstStage.id } })
  }
```

Substituir por:

```typescript
  let lead = await prisma.lead.findUnique({ where: { phone } })
  if (!lead) {
    const firstStage = await prisma.leadStage.findFirst({ orderBy: { order: 'asc' } })
    if (!firstStage) return
    const pushName = typeof data.pushName === 'string' && data.pushName.trim() ? data.pushName : null
    lead = await prisma.lead.create({ data: { phone, stageId: firstStage.id, name: pushName } })
  }
```

Não altera mais nada na função — leads já existentes continuam sem ter o nome atualizado em mensagens seguintes (decisão explícita do design).

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro.

- [ ] **Step 3: Verificar com um webhook de teste**

Com `npm run dev` rodando:

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"messages.upsert","instance":"test","data":{"key":{"remoteJid":"5511911112222@s.whatsapp.net","id":"PUSHNAMECHECK001","fromMe":false},"pushName":"Maria Teste","message":{"conversation":"oi"}}}'
```

Confira (via Prisma Studio ou uma query rápida) que o `Lead` criado com `phone = "5511911112222"` tem `name = "Maria Teste"`. Depois, **apague esse lead e mensagem de teste** antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/whatsapp/webhook/route.ts
git commit -m "feat: captura pushName do WhatsApp na criacao do lead"
```

---

## Task 3: Rotas de API — Touchpoints e Valor

**Files:**
- Modify: `src/app/api/crm/leads/[id]/route.ts`
- Modify: `src/app/api/crm/stages/route.ts`

- [ ] **Step 1: `leads/[id]/route.ts` — GET inclui `_count.messages`, PUT aceita `value`**

Substituir o arquivo inteiro por:

```typescript
// src/app/api/crm/leads/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
  })

  if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  return NextResponse.json(lead)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, stageId, assignedToId, value } = await request.json()

  try {
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(stageId !== undefined && { stageId }),
        ...(assignedToId !== undefined && { assignedToId }),
        ...(value !== undefined && { value }),
      },
    })
    return NextResponse.json(lead)
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }
    if (code === 'P2003') {
      return NextResponse.json({ error: 'Etapa ou responsável informado não existe' }, { status: 400 })
    }
    throw error
  }
}
```

- [ ] **Step 2: `stages/route.ts` — GET inclui `_count.messages` nos leads**

No `include.leads.include` (dentro da função `GET`), adicionar `_count` ao lado de `tags`/`assignedTo`/`messages`:

```typescript
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stages = await prisma.leadStage.findMany({
    orderBy: { order: 'asc' },
    include: {
      leads: {
        orderBy: { updatedAt: 'desc' },
        include: {
          tags: { include: { tag: true } },
          assignedTo: { select: { id: true, name: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
      },
    },
  })

  return NextResponse.json(stages)
}
```

Não muda nada no `POST` desse arquivo.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro relacionado a esses dois arquivos (pode haver erros esperados em `src/types/crm.ts`/componentes até a Task 4/6/7/8 — ignore por agora se forem só sobre `_count`/`value` não existirem no tipo `Lead`).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/crm/leads/\[id\]/route.ts src/app/api/crm/stages/route.ts
git commit -m "feat: adiciona touchpoints (_count.messages) e campo value nas rotas de lead"
```

---

## Task 4: Tipos e Hook

**Files:**
- Modify: `src/types/crm.ts`
- Modify: `src/hooks/crm-api.ts`

- [ ] **Step 1: `types/crm.ts` — `Lead` ganha `value` e `_count`**

Substituir a interface `Lead`:

```typescript
export interface Lead {
  id: string
  name: string | null
  phone: string
  stageId: string
  assignedToId: string | null
  assignedTo: CrmUser | null
  value: number | null
  tags: LeadTagWithTag[]
  messages: Message[]
  _count: { messages: number }
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2: `hooks/crm-api.ts` — `useUpdateLead` aceita `value`**

Substituir a função `useUpdateLead`:

```typescript
export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      name?: string
      stageId?: string
      assignedToId?: string | null
      value?: number | null
    }) => {
      const res = await fetch(`/api/crm/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update lead')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-stages'] }),
  })
}
```

Não muda mais nada nesse arquivo.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: os erros sobre `_count`/`value` desaparecem. Pode restar 1 erro esperado em `lead-panel.tsx` (ainda não atualizado) — normal, será resolvido na Task 7.

- [ ] **Step 4: Commit**

```bash
git add src/types/crm.ts src/hooks/crm-api.ts
git commit -m "feat: adiciona value e _count aos tipos, useUpdateLead aceita value"
```

---

## Task 5: Componente `LeadConversaTab`

**Files:**
- Create: `src/components/crm/lead-conversa-tab.tsx`

- [ ] **Step 1: Criar o componente (extraído do chat atual em `lead-panel.tsx`)**

```typescript
// src/components/crm/lead-conversa-tab.tsx
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
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo relacionado a este arquivo.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/lead-conversa-tab.tsx
git commit -m "feat: extrai chat do lead para componente LeadConversaTab"
```

---

## Task 6: Componente `LeadInfoTab`

**Files:**
- Create: `src/components/crm/lead-info-tab.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
// src/components/crm/lead-info-tab.tsx
'use client'

import { useState } from 'react'
import { Tag as TagIcon, Plus, Copy, Check, X } from 'lucide-react'
import {
  useCrmTags,
  useCreateCrmTag,
  useAttachTag,
  useDetachTag,
  useCrmUsers,
  useUpdateLead,
} from '@/hooks/crm-api'
import type { Lead, LeadStage } from '@/types/crm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  const { data: users } = useCrmUsers()
  const updateLead = useUpdateLead()

  const [isAddingTag, setIsAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')
  const [valueDraft, setValueDraft] = useState(lead.value?.toString() ?? '')
  const [copied, setCopied] = useState(false)

  const attachedTagIds = new Set(lead.tags.map((lt) => lt.tagId))

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
    const parsed = valueDraft.trim() === '' ? null : parseFloat(valueDraft)
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

        <span className="text-slate-500">Pipeline</span>
        <span className="text-white">Pipeline Principal</span>

        <span className="text-slate-500">Estágio</span>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit"
          style={{ backgroundColor: `${stage.color}26`, color: stage.color }}
        >
          {stage.name}
        </span>

        <span className="text-slate-500">Contato</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-white truncate">{lead.name || lead.phone}</span>
          <span className="text-slate-500 text-xs shrink-0">{lead.phone}</span>
          <button onClick={handleCopyPhone} className="text-slate-500 hover:text-white cursor-pointer shrink-0">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
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

        <span className="text-slate-500">Dono</span>
        <select
          value={lead.assignedToId ?? ''}
          onChange={(e) => updateLead.mutate({ id: lead.id, assignedToId: e.target.value || null })}
          className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-2 py-1 text-sm text-white outline-none focus:border-blue-500/50"
        >
          <option value="" className="bg-[#0a0b10]">Sem responsável</option>
          {(users || []).map((u) => (
            <option key={u.id} value={u.id} className="bg-[#0a0b10]">
              {u.name}
            </option>
          ))}
        </select>

        <span className="text-slate-500">Touchpoints</span>
        <span className="text-white">{lead._count.messages}</span>
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
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo relacionado a este arquivo.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/lead-info-tab.tsx
git commit -m "feat: adiciona aba de informacoes do lead (avatar, contato, valor, touchpoints, tags)"
```

---

## Task 7: Componente `LeadPanel` (casca com abas)

**Files:**
- Modify: `src/components/crm/lead-panel.tsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```typescript
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
```

- [ ] **Step 2: Verificar tipos (deve estar 100% limpo agora)**

Run: `npx tsc --noEmit`
Expected: nenhum erro em todo o projeto.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/lead-panel.tsx
git commit -m "feat: reestrutura LeadPanel em casca com abas Info e Conversa"
```

---

## Task 8: Verificação Ponta a Ponta no Navegador

- [ ] **Step 1: Subir o servidor e logar**

```bash
npm run dev
```
Logar via `http://localhost:3000/login` com um usuário de teste já existente no banco.

- [ ] **Step 2: Criar um lead de teste com nome via webhook**

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"messages.upsert","instance":"test","data":{"key":{"remoteJid":"5511933334444@s.whatsapp.net","id":"FINALCHECK001","fromMe":false},"pushName":"João Verificação","message":{"conversation":"Mensagem de teste"}}}'
```

- [ ] **Step 3: Abrir a aba CRM e clicar no card do lead criado**

Expected:
- Card mostra "João Verificação" (não o telefone) como nome.
- Painel abre na aba "Info" por padrão: avatar com a letra "J", "Criado em" com a data de hoje, "Pipeline Principal", badge de Estágio mostrando "Novo Contato" (cor azul), Contato com nome+telefone+botão de copiar, Valor vazio ("—" ou campo em branco), Dono "Sem responsável", Touchpoints "1", Tags vazio.
- Clicar no botão de copiar telefone funciona (ícone vira check por 1s).
- Editar o campo Valor (ex: `1500`), sair do campo (blur) → persiste após recarregar a página.
- Clicar na aba "Conversa" → mostra a mensagem "Mensagem de teste" recebida.
- Enviar uma mensagem pelo composer → comportamento igual ao já existente (sucesso ou falha gracefully, dependendo da config da Evolution API).

- [ ] **Step 4: Limpar o lead de teste**

Apague o `Lead`/`Message` criados no Step 2 (via Prisma Studio ou script temporário) antes de finalizar.

- [ ] **Step 5: Commit final (se houver algum ajuste pós-verificação)**

```bash
git add -A
git commit -m "fix: ajustes pos-verificacao da aba info do lead"
```
(Só se necessário — se tudo passou de primeira, não há o que commitar aqui.)
