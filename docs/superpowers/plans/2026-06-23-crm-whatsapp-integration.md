# CRM com Inbox de WhatsApp (Evolution API) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma aba "CRM" no sistemaMelo com um Kanban de leads vinculados a conversas de WhatsApp (via Evolution API self-hosted), com painel lateral de chat embutido, tags e atribuição de responsável.

**Architecture:** Webhook da Evolution API grava leads/mensagens no Postgres (via Prisma) de forma idempotente; um event bus em memória (Node `EventEmitter`) propaga novidades para um endpoint SSE consumido pela UI; o envio de mensagens chama a Evolution API via um cliente HTTP simples (mesmo padrão do `automacao-proxy.ts` já existente). A UI reaproveita o padrão de Kanban (`@dnd-kit`) já usado em `kanban-board.tsx`, mas simplificado (sem reordenação de coluna/card — apenas mover lead entre estágios).

**Tech Stack:** Next.js 16 App Router, Prisma 6 + PostgreSQL, next-auth, TypeScript, `@dnd-kit/core`, TanStack React Query, Tailwind, lucide-react, shadcn/ui (`@base-ui/react`).

**Referência de design:** `docs/superpowers/specs/2026-06-23-crm-whatsapp-integration-design.md`

---

## File Map

**Modify:**
- `prisma/schema.prisma` — novos modelos + back-relation em `User`
- `prisma/seed.ts` — seed de `LeadStage` e `CrmTag` padrão
- `src/app/page.tsx` — nova aba "CRM"
- `.env.example` — novas variáveis de ambiente

**Create — lib:**
- `src/lib/phone.ts`
- `src/lib/evolution-client.ts`
- `src/lib/crm-events.ts`

**Create — types:**
- `src/types/crm.ts`

**Create — API routes:**
- `src/app/api/whatsapp/webhook/route.ts`
- `src/app/api/crm/leads/[id]/route.ts`
- `src/app/api/crm/leads/[id]/messages/route.ts`
- `src/app/api/crm/leads/[id]/tags/route.ts`
- `src/app/api/crm/leads/[id]/tags/[tagId]/route.ts`
- `src/app/api/crm/stages/route.ts`
- `src/app/api/crm/stages/[id]/route.ts`
- `src/app/api/crm/tags/route.ts`
- `src/app/api/crm/tags/[id]/route.ts`
- `src/app/api/crm/users/route.ts`
- `src/app/api/crm/connection/route.ts`
- `src/app/api/crm/connection/qrcode/route.ts`
- `src/app/api/crm/stream/route.ts`

**Create — hooks:**
- `src/hooks/crm-api.ts`

**Create — components:**
- `src/components/crm/kanban-leads.tsx`
- `src/components/crm/lead-column.tsx`
- `src/components/crm/lead-card.tsx`
- `src/components/crm/lead-panel.tsx`
- `src/components/crm/whatsapp-settings.tsx`

**Fora deste plano (infra, não-código):** provisionar o servidor da Evolution API e criar a instância — pré-requisito documentado na Task 19.

**Nota sobre testes:** este projeto não usa um framework de testes automatizados (sem jest/vitest no `package.json`). Seguindo a convenção já estabelecida (ver `docs/superpowers/plans/2026-06-22-automacao-ml-integration.md`), a verificação de cada passo é manual: `tsc --noEmit` para checagem de tipos em arquivos de lógica pura, `curl`/Prisma Studio para rotas de API, e o console do navegador (`fetch`, já autenticado via cookie de sessão) para rotas que exigem login.

---

## Task 1: Prisma Schema — Modelos do CRM

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar back-relation no model `User`**

Em `prisma/schema.prisma`, dentro do `model User`, adicionar o campo `leads`:

```prisma
model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  leads        Lead[]
}
```

- [ ] **Step 2: Adicionar os novos modelos no final do arquivo**

Adicionar ao final de `prisma/schema.prisma`:

```prisma
model Lead {
  id           String     @id @default(cuid())
  name         String?
  phone        String     @unique
  stageId      String
  stage        LeadStage  @relation(fields: [stageId], references: [id])
  assignedToId String?
  assignedTo   User?      @relation(fields: [assignedToId], references: [id])
  messages     Message[]
  tags         LeadTag[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

model LeadStage {
  id    String @id @default(cuid())
  name  String
  order Int
  color String @default("#3b82f6")
  leads Lead[]
}

model Message {
  id                String           @id @default(cuid())
  leadId            String
  lead              Lead             @relation(fields: [leadId], references: [id], onDelete: Cascade)
  whatsappMessageId String           @unique
  direction         MessageDirection
  content           String
  status            MessageStatus?
  createdAt         DateTime         @default(now())
}

model CrmTag {
  id    String    @id @default(cuid())
  name  String
  color String
  leads LeadTag[]
}

model LeadTag {
  leadId String
  tagId  String
  lead   Lead   @relation(fields: [leadId], references: [id], onDelete: Cascade)
  tag    CrmTag @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([leadId, tagId])
}

model WhatsappConnection {
  id        String   @id @default(cuid())
  status    String   @default("close")
  updatedAt DateTime @updatedAt
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageStatus {
  SENT
  DELIVERED
  READ
  FAILED
}
```

- [ ] **Step 3: Aplicar o schema no banco**

Run: `npm run db:push`
Expected: `Your database is now in sync with your Prisma schema.` (e regeneração do client Prisma sem erros).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: adiciona modelos Prisma do CRM (Lead, LeadStage, Message, CrmTag, WhatsappConnection)"
```

---

## Task 2: Seed — Estágios e Tags Padrão

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Adicionar seed de `LeadStage` e `CrmTag`**

Em `prisma/seed.ts`, antes da linha `console.log('Seed executed successfully')`, adicionar:

```typescript
  // Create initial CRM lead stages if none exist
  const stageCount = await prisma.leadStage.count()
  if (stageCount === 0) {
    const defaultStages = [
      { name: 'Novo Contato', order: 1000, color: '#3b82f6' },
      { name: 'Em Conversa', order: 2000, color: '#f59e0b' },
      { name: 'Qualificado', order: 3000, color: '#10b981' },
      { name: 'Cliente', order: 4000, color: '#8b5cf6' },
    ]

    for (const stage of defaultStages) {
      await prisma.leadStage.create({ data: stage })
    }
  }

  // Create initial CRM tags if none exist
  const crmTagCount = await prisma.crmTag.count()
  if (crmTagCount === 0) {
    const defaultTags = [
      { name: 'Quente', color: '#ef4444' },
      { name: 'Frio', color: '#3b82f6' },
      { name: 'Indicação', color: '#10b981' },
    ]

    for (const tag of defaultTags) {
      await prisma.crmTag.create({ data: tag })
    }
  }
```

- [ ] **Step 2: Rodar o seed**

Run: `npm run db:seed`
Expected: `Seed executed successfully` sem erros.

- [ ] **Step 3: Verificar via Prisma Studio**

Run: `npx prisma studio`
Expected: abre `http://localhost:5555`; as tabelas `LeadStage` (4 linhas) e `CrmTag` (3 linhas) aparecem populadas.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: adiciona seed de estagios e tags padrao do CRM"
```

---

## Task 3: Tipos TypeScript do CRM

**Files:**
- Create: `src/types/crm.ts`

- [ ] **Step 1: Criar o arquivo de tipos**

```typescript
// src/types/crm.ts
export interface CrmTag {
  id: string
  name: string
  color: string
}

export interface LeadTagWithTag {
  leadId: string
  tagId: string
  tag: CrmTag
}

export interface CrmUser {
  id: string
  name: string
}

export interface Message {
  id: string
  leadId: string
  whatsappMessageId: string
  direction: 'INBOUND' | 'OUTBOUND'
  content: string
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null
  createdAt: string
}

export interface Lead {
  id: string
  name: string | null
  phone: string
  stageId: string
  assignedToId: string | null
  assignedTo: CrmUser | null
  tags: LeadTagWithTag[]
  messages: Message[]
  createdAt: string
  updatedAt: string
}

export interface LeadStage {
  id: string
  name: string
  order: number
  color: string
  leads: Lead[]
}

export interface WhatsappConnection {
  id?: string
  status: string
  updatedAt?: string
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro relacionado a `src/types/crm.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/types/crm.ts
git commit -m "feat: adiciona tipos TypeScript do CRM"
```

---

## Task 4: Utilitário de Normalização de Telefone

**Files:**
- Create: `src/lib/phone.ts`

- [ ] **Step 1: Criar a função de normalização**

```typescript
// src/lib/phone.ts
/** Normaliza um telefone/JID do WhatsApp para E.164 sem o "+": ex. "5511999999999" */
export function normalizePhone(raw: string): string {
  const digits = raw.replace('@s.whatsapp.net', '').replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}
```

- [ ] **Step 2: Verificar manualmente**

Run: `npx tsx -e "import { normalizePhone } from './src/lib/phone.js'; console.log(normalizePhone('5511999999999@s.whatsapp.net')); console.log(normalizePhone('11999999999')); console.log(normalizePhone('(11) 99999-9999'))"`
Expected (três linhas): `5511999999999`, `5511999999999`, `5511999999999`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/phone.ts
git commit -m "feat: adiciona normalizacao de telefone E.164"
```

---

## Task 5: Cliente Evolution API

**Files:**
- Create: `src/lib/evolution-client.ts`

- [ ] **Step 1: Criar o cliente HTTP**

Segue o mesmo padrão de `src/lib/automacao-proxy.ts` (URL + API key em env var, `fetch` com tratamento de erro):

```typescript
// src/lib/evolution-client.ts
const BASE_URL = process.env.EVOLUTION_API_URL ?? ''
const API_KEY = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

function evolutionRequest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: API_KEY,
      ...(init?.headers ?? {}),
    },
  })
}

export interface SendTextResult {
  key: { id: string }
}

export async function sendTextMessage(phone: string, text: string): Promise<SendTextResult> {
  const res = await evolutionRequest(`/message/sendText/${INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({ number: phone, text }),
  })
  if (!res.ok) throw new Error(`Evolution API retornou ${res.status}`)
  const data = await res.json()
  if (!data?.key?.id) throw new Error('Resposta da Evolution API sem ID de mensagem')
  return data as SendTextResult
}

export interface ConnectionStateResult {
  instance: { state: string }
}

export async function getConnectionState(): Promise<ConnectionStateResult> {
  const res = await evolutionRequest(`/instance/connectionState/${INSTANCE}`)
  if (!res.ok) throw new Error(`Evolution API retornou ${res.status}`)
  return res.json()
}

export interface QrCodeResult {
  base64?: string
}

export async function getQrCode(): Promise<QrCodeResult> {
  const res = await evolutionRequest(`/instance/connect/${INSTANCE}`)
  if (!res.ok) throw new Error(`Evolution API retornou ${res.status}`)
  return res.json()
}
```

> Nota: os nomes de endpoint (`/message/sendText/{instance}`, `/instance/connectionState/{instance}`, `/instance/connect/{instance}`) seguem a Evolution API v2. Se a instância provisionada na Task 19 estiver em outra versão, confira os nomes exatos na documentação dela antes de testar esta lib.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro relacionado a `src/lib/evolution-client.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/evolution-client.ts
git commit -m "feat: adiciona cliente HTTP para Evolution API"
```

---

## Task 6: Event Bus em Memória (para SSE)

**Files:**
- Create: `src/lib/crm-events.ts`

- [ ] **Step 1: Criar o emissor de eventos**

Mesmo truque de singleton via `globalThis` já usado em `src/lib/prisma.ts`, para sobreviver ao hot-reload do `next dev`:

```typescript
// src/lib/crm-events.ts
import { EventEmitter } from 'events'

export type CrmEvent =
  | { type: 'new-message'; leadId: string; message: unknown }
  | { type: 'connection-update'; status: string }

const globalForEvents = globalThis as typeof globalThis & { crmEventEmitter?: EventEmitter }

export const crmEvents = globalForEvents.crmEventEmitter ?? new EventEmitter()
crmEvents.setMaxListeners(0)

if (process.env.NODE_ENV !== 'production') globalForEvents.crmEventEmitter = crmEvents

export function emitCrmEvent(event: CrmEvent) {
  crmEvents.emit('event', event)
}

export function subscribeCrmEvents(listener: (event: CrmEvent) => void): () => void {
  crmEvents.on('event', listener)
  return () => crmEvents.off('event', listener)
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro relacionado a `src/lib/crm-events.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/crm-events.ts
git commit -m "feat: adiciona event bus em memoria para SSE do CRM"
```

---

## Task 7: Webhook da Evolution API

**Files:**
- Create: `src/app/api/whatsapp/webhook/route.ts`

- [ ] **Step 1: Criar a rota de webhook**

```typescript
// src/app/api/whatsapp/webhook/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'
import { emitCrmEvent } from '@/lib/crm-events'

const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET ?? ''

function isAuthorized(request: Request): boolean {
  if (!WEBHOOK_SECRET) return true
  const headerSecret = request.headers.get('x-webhook-secret')
  if (headerSecret === WEBHOOK_SECRET) return true
  const { searchParams } = new URL(request.url)
  return searchParams.get('secret') === WEBHOOK_SECRET
}

function extractMessageText(message: Record<string, unknown> | undefined): string | null {
  if (!message) return null
  if (typeof message.conversation === 'string') return message.conversation
  const extended = message.extendedTextMessage as { text?: string } | undefined
  if (extended?.text) return extended.text
  return null
}

function describeMediaType(message: Record<string, unknown> | undefined): string | null {
  if (!message) return null
  if (message.imageMessage) return 'imagem'
  if (message.audioMessage) return 'áudio'
  if (message.videoMessage) return 'vídeo'
  if (message.documentMessage) return 'documento'
  return null
}

async function handleMessagesUpsert(data: Record<string, unknown>) {
  const key = data.key as { remoteJid?: string; id?: string; fromMe?: boolean } | undefined
  if (!key?.remoteJid || !key.id) return
  if (key.fromMe) return // já registrado ao enviar via /api/crm/leads/[id]/messages

  const phone = normalizePhone(key.remoteJid)
  const message = data.message as Record<string, unknown> | undefined
  const text = extractMessageText(message)
  const mediaType = text ? null : describeMediaType(message)
  const content = text ?? (mediaType ? `[mídia recebida — tipo: ${mediaType}]` : '[mensagem não suportada]')

  let lead = await prisma.lead.findUnique({ where: { phone } })
  if (!lead) {
    const firstStage = await prisma.leadStage.findFirst({ orderBy: { order: 'asc' } })
    if (!firstStage) return
    lead = await prisma.lead.create({ data: { phone, stageId: firstStage.id } })
  }

  try {
    const created = await prisma.message.create({
      data: {
        leadId: lead.id,
        whatsappMessageId: key.id,
        direction: 'INBOUND',
        content,
      },
    })
    emitCrmEvent({ type: 'new-message', leadId: lead.id, message: created })
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code !== 'P2002') throw error // duplicado (reenvio do webhook) — ignora
  }
}

async function handleConnectionUpdate(data: Record<string, unknown>) {
  const state = typeof data.state === 'string' ? data.state : 'close'

  const existing = await prisma.whatsappConnection.findFirst()
  if (existing) {
    await prisma.whatsappConnection.update({ where: { id: existing.id }, data: { status: state } })
  } else {
    await prisma.whatsappConnection.create({ data: { status: state } })
  }

  emitCrmEvent({ type: 'connection-update', status: state })
}

// Mapeia o código de ACK do Baileys (0=pending, 1=server_ack, 2=delivery_ack, 3/4=read/played)
const ACK_STATUS_MAP: Record<string, 'SENT' | 'DELIVERED' | 'READ'> = {
  '1': 'SENT',
  '2': 'DELIVERED',
  '3': 'READ',
  '4': 'READ',
}

async function handleMessagesUpdate(data: Record<string, unknown>) {
  const key = data.key as { id?: string } | undefined
  const keyId = (data.keyId ?? key?.id) as string | undefined
  if (!keyId) return

  const status = ACK_STATUS_MAP[String(data.status ?? '')]
  if (!status) return

  try {
    const updated = await prisma.message.update({
      where: { whatsappMessageId: keyId },
      data: { status },
    })
    emitCrmEvent({ type: 'new-message', leadId: updated.leadId, message: updated })
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code !== 'P2025') throw error // mensagem ainda não existe localmente — ignora
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const event = body.event as string
  const data = (body.data ?? {}) as Record<string, unknown>

  if (event === 'messages.upsert') {
    await handleMessagesUpsert(data)
  } else if (event === 'connection.update') {
    await handleConnectionUpdate(data)
  } else if (event === 'messages.update') {
    await handleMessagesUpdate(data)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Subir o servidor de desenvolvimento**

Run: `npm run dev`
Expected: `Ready in ...ms` em `http://localhost:3000`.

- [ ] **Step 3: Simular uma mensagem chegando (em outro terminal)**

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"messages.upsert","instance":"test","data":{"key":{"remoteJid":"5511999999999@s.whatsapp.net","id":"TESTMSG001","fromMe":false},"message":{"conversation":"Ola, quero saber mais"}}}'
```
Expected: `{"ok":true}`.

- [ ] **Step 4: Verificar no Prisma Studio**

Run: `npx prisma studio` (se não estiver aberto)
Expected: 1 nova linha em `Lead` com `phone = "5511999999999"` e `stageId` apontando para "Novo Contato"; 1 nova linha em `Message` com `content = "Ola, quero saber mais"` e `direction = INBOUND`.

- [ ] **Step 5: Reenviar o mesmo curl do Step 3 (testar idempotência)**

Run: o mesmo comando do Step 3 novamente.
Expected: `{"ok":true}` e **nenhuma** linha nova em `Message` (continua só 1 linha, mesmo `whatsappMessageId`).

- [ ] **Step 6: Simular uma confirmação de entrega (`messages.update`)**

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"messages.update","instance":"test","data":{"keyId":"TESTMSG001","status":"2"}}'
```
Expected: `{"ok":true}`. No Prisma Studio, a `Message` com `whatsappMessageId = "TESTMSG001"` deve ter `status = DELIVERED`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/whatsapp/webhook/
git commit -m "feat: adiciona webhook da Evolution API (mensagens, status de entrega e conexao)"
```

---

## Task 8: Rota de Mensagens (listar + enviar)

**Files:**
- Create: `src/app/api/crm/leads/[id]/messages/route.ts`

- [ ] **Step 1: Criar a rota**

```typescript
// src/app/api/crm/leads/[id]/messages/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendTextMessage } from '@/lib/evolution-client'
import { emitCrmEvent } from '@/lib/crm-events'
import { randomUUID } from 'crypto'

const RATE_LIMIT_PER_MINUTE = 30
const sentTimestamps: number[] = []

function checkRateLimit(): boolean {
  const now = Date.now()
  while (sentTimestamps.length && now - sentTimestamps[0] > 60_000) sentTimestamps.shift()
  if (sentTimestamps.length >= RATE_LIMIT_PER_MINUTE) return false
  sentTimestamps.push(now)
  return true
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const messages = await prisma.message.findMany({
    where: { leadId: id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(messages)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!checkRateLimit()) {
    return NextResponse.json({ error: 'Limite de envio atingido, aguarde um minuto' }, { status: 429 })
  }

  const { id } = await params
  const { content } = await request.json()

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  try {
    const result = await sendTextMessage(lead.phone, content)
    const message = await prisma.message.create({
      data: {
        leadId: lead.id,
        whatsappMessageId: result.key.id,
        direction: 'OUTBOUND',
        content,
        status: 'SENT',
      },
    })
    emitCrmEvent({ type: 'new-message', leadId: lead.id, message })
    return NextResponse.json(message)
  } catch (error) {
    const message = await prisma.message.create({
      data: {
        leadId: lead.id,
        whatsappMessageId: `failed-${randomUUID()}`,
        direction: 'OUTBOUND',
        content,
        status: 'FAILED',
      },
    })
    emitCrmEvent({ type: 'new-message', leadId: lead.id, message })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao enviar mensagem' },
      { status: 502 }
    )
  }
}
```

> Nota: sem `EVOLUTION_API_URL` configurado (Task 19 ainda não feita), o `POST` sempre cairá no `catch` e gravará a mensagem como `FAILED` — comportamento esperado até a instância da Evolution existir de fato.

- [ ] **Step 2: Verificar o GET (lista vazia/com a mensagem do Task 7)**

Com `npm run dev` rodando e você logado em `http://localhost:3000`, abra o DevTools do navegador (F12) → aba Console, e rode (substitua `LEAD_ID` pelo id do lead criado no Task 7, visível no Prisma Studio):

```javascript
fetch('/api/crm/leads/LEAD_ID/messages').then(r => r.json()).then(console.log)
```
Expected: array com 1 mensagem (`content: "Ola, quero saber mais"`, `direction: "INBOUND"`).

- [ ] **Step 3: Verificar o POST (falha esperada sem Evolution configurada)**

No mesmo Console:

```javascript
fetch('/api/crm/leads/LEAD_ID/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: 'Teste de envio' }),
}).then(r => r.json()).then(console.log)
```
Expected: `{ error: "..." }` (já que `EVOLUTION_API_URL` ainda não está configurada). Confira no Prisma Studio que uma nova `Message` com `status: FAILED` foi criada.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/crm/leads/
git commit -m "feat: adiciona rota de listagem e envio de mensagens do lead"
```

---

## Task 9: Rota SSE (tempo real)

**Files:**
- Create: `src/app/api/crm/stream/route.ts`

- [ ] **Step 1: Criar a rota SSE**

```typescript
// src/app/api/crm/stream/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { subscribeCrmEvents } from '@/lib/crm-events'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return new Response('Unauthorized', { status: 401 })

  let unsubscribe: () => void = () => {}
  let heartbeat: ReturnType<typeof setInterval>

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(`: connected\n\n`))

      unsubscribe = subscribeCrmEvents((event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      })

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`))
      }, 25_000)
    },
    cancel() {
      unsubscribe()
      clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Verificar a conexão SSE no navegador**

Com `npm run dev` rodando e você logado, abra `http://localhost:3000/api/crm/stream` diretamente em uma nova aba do navegador.
Expected: a aba fica "carregando" (conexão aberta, não retorna). Abra o DevTools → Network → clique na requisição `stream` → aba "Response" (ou "EventStream"): deve aparecer a linha `: connected`.

- [ ] **Step 3: Verificar que eventos chegam em tempo real**

Com a aba do Step 2 ainda aberta, em outro terminal repita o curl do Task 7 Step 3 (pode trocar o `id` da mensagem para `TESTMSG002` e o texto, já que `TESTMSG001` foi consumido):

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"messages.upsert","instance":"test","data":{"key":{"remoteJid":"5511999999999@s.whatsapp.net","id":"TESTMSG002","fromMe":false},"message":{"conversation":"Segunda mensagem"}}}'
```
Expected: na aba do Step 2 (Network → EventStream), aparece uma nova linha `data: {"type":"new-message",...}` quase instantaneamente.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/crm/stream/
git commit -m "feat: adiciona rota SSE para eventos em tempo real do CRM"
```

---

## Task 10: Rotas de Estágios (LeadStage)

**Files:**
- Create: `src/app/api/crm/stages/route.ts`
- Create: `src/app/api/crm/stages/[id]/route.ts`

- [ ] **Step 1: Criar `GET`/`POST` em `stages/route.ts`**

```typescript
// src/app/api/crm/stages/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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
        },
      },
    },
  })

  return NextResponse.json(stages)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, color } = await request.json()

  const lastStage = await prisma.leadStage.findFirst({ orderBy: { order: 'desc' } })
  const newOrder = (lastStage?.order ?? 0) + 1000

  const stage = await prisma.leadStage.create({
    data: { name, color: color || '#3b82f6', order: newOrder },
  })

  return NextResponse.json(stage)
}
```

- [ ] **Step 2: Criar `PUT`/`DELETE` em `stages/[id]/route.ts`**

```typescript
// src/app/api/crm/stages/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, color, order } = await request.json()

  const stage = await prisma.leadStage.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
      ...(order !== undefined && { order }),
    },
  })

  return NextResponse.json(stage)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const leadCount = await prisma.lead.count({ where: { stageId: id } })
  if (leadCount > 0) {
    return NextResponse.json(
      { error: 'Mova os leads para outra etapa antes de excluir esta' },
      { status: 400 }
    )
  }

  await prisma.leadStage.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Verificar via Console do navegador (logado)**

```javascript
fetch('/api/crm/stages').then(r => r.json()).then(console.log)
```
Expected: array com as 4 etapas do seed, cada uma com `leads: [...]` (a "Novo Contato" deve ter o lead criado no Task 7).

```javascript
fetch('/api/crm/stages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Teste', color: '#06b6d4' }),
}).then(r => r.json()).then(console.log)
```
Expected: objeto da nova etapa criada com `order: 5000`.

- [ ] **Step 4: Verificar a regra de exclusão bloqueada**

```javascript
fetch('/api/crm/stages').then(r => r.json()).then(stages => {
  const novoContato = stages.find(s => s.name === 'Novo Contato')
  return fetch(`/api/crm/stages/${novoContato.id}`, { method: 'DELETE' }).then(r => r.json())
}).then(console.log)
```
Expected: `{ error: "Mova os leads para outra etapa antes de excluir esta" }` (status 400), já que essa etapa tem o lead do Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/crm/stages/
git commit -m "feat: adiciona rotas CRUD de estagios do CRM"
```

---

## Task 11: Rota de Atualização de Lead

**Files:**
- Create: `src/app/api/crm/leads/[id]/route.ts`

- [ ] **Step 1: Criar a rota**

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
    },
  })

  if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  return NextResponse.json(lead)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, stageId, assignedToId } = await request.json()

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(stageId !== undefined && { stageId }),
      ...(assignedToId !== undefined && { assignedToId }),
    },
  })

  return NextResponse.json(lead)
}
```

- [ ] **Step 2: Verificar movendo o lead entre etapas**

No Console do navegador (logado), substituindo `LEAD_ID` e usando o id da etapa "Teste" criada no Task 10:

```javascript
fetch('/api/crm/leads/LEAD_ID', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ stageId: 'STAGE_ID_DA_ETAPA_TESTE' }),
}).then(r => r.json()).then(console.log)
```
Expected: objeto do lead com `stageId` atualizado. Confirme rodando `fetch('/api/crm/stages').then(r=>r.json()).then(console.log)` novamente: o lead deve aparecer agora dentro de `leads` da etapa "Teste".

- [ ] **Step 3: Commit**

```bash
git add src/app/api/crm/leads/[id]/route.ts
git commit -m "feat: adiciona rota de leitura e atualizacao de lead"
```

---

## Task 12: Rotas de Tags (CrmTag) e vínculo com Lead

**Files:**
- Create: `src/app/api/crm/tags/route.ts`
- Create: `src/app/api/crm/tags/[id]/route.ts`
- Create: `src/app/api/crm/leads/[id]/tags/route.ts`
- Create: `src/app/api/crm/leads/[id]/tags/[tagId]/route.ts`

- [ ] **Step 1: Criar `GET`/`POST` em `tags/route.ts`**

```typescript
// src/app/api/crm/tags/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tags = await prisma.crmTag.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(tags)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, color } = await request.json()
  const tag = await prisma.crmTag.create({ data: { name, color: color || '#64748b' } })
  return NextResponse.json(tag)
}
```

- [ ] **Step 2: Criar `PUT`/`DELETE` em `tags/[id]/route.ts`**

```typescript
// src/app/api/crm/tags/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, color } = await request.json()

  const tag = await prisma.crmTag.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
    },
  })

  return NextResponse.json(tag)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.crmTag.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Criar `POST` em `leads/[id]/tags/route.ts` (vincular)**

```typescript
// src/app/api/crm/leads/[id]/tags/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { tagId } = await request.json()

  const leadTag = await prisma.leadTag.upsert({
    where: { leadId_tagId: { leadId: id, tagId } },
    update: {},
    create: { leadId: id, tagId },
  })

  return NextResponse.json(leadTag)
}
```

- [ ] **Step 4: Criar `DELETE` em `leads/[id]/tags/[tagId]/route.ts` (desvincular)**

```typescript
// src/app/api/crm/leads/[id]/tags/[tagId]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, tagId } = await params
  await prisma.leadTag.delete({ where: { leadId_tagId: { leadId: id, tagId } } })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Verificar vínculo de tag no Console do navegador**

```javascript
fetch('/api/crm/tags').then(r => r.json()).then(console.log)
```
Expected: array com as 3 tags do seed (`Quente`, `Frio`, `Indicação`).

```javascript
fetch('/api/crm/tags').then(r => r.json()).then(tags => {
  const quente = tags.find(t => t.name === 'Quente')
  return fetch('/api/crm/leads/LEAD_ID/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tagId: quente.id }),
  }).then(r => r.json())
}).then(console.log)
```
Expected: objeto `{ leadId, tagId }`. Confirme com `fetch('/api/crm/stages').then(r=>r.json()).then(console.log)` que o lead agora tem `tags: [{ tag: { name: "Quente", ... } }]`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/crm/tags/ src/app/api/crm/leads/[id]/tags/
git commit -m "feat: adiciona rotas CRUD de tags e vinculo com lead"
```

---

## Task 13: Rotas de Usuários e Conexão WhatsApp

**Files:**
- Create: `src/app/api/crm/users/route.ts`
- Create: `src/app/api/crm/connection/route.ts`
- Create: `src/app/api/crm/connection/qrcode/route.ts`

- [ ] **Step 1: Criar `users/route.ts`**

```typescript
// src/app/api/crm/users/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const users = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}
```

- [ ] **Step 2: Criar `connection/route.ts`**

```typescript
// src/app/api/crm/connection/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connection = await prisma.whatsappConnection.findFirst()
  return NextResponse.json(connection ?? { status: 'close' })
}
```

- [ ] **Step 3: Criar `connection/qrcode/route.ts`**

```typescript
// src/app/api/crm/connection/qrcode/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getQrCode } from '@/lib/evolution-client'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await getQrCode()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao obter QR code' },
      { status: 502 }
    )
  }
}
```

- [ ] **Step 4: Verificar no Console do navegador**

```javascript
fetch('/api/crm/users').then(r => r.json()).then(console.log)
```
Expected: array com os 4 usuários do seed (`Usuário 1`...`Usuário 4`).

```javascript
fetch('/api/crm/connection').then(r => r.json()).then(console.log)
```
Expected: `{ status: "close" }` (nenhuma conexão registrada ainda, já que a Evolution não está configurada).

```javascript
fetch('/api/crm/connection/qrcode').then(r => r.json()).then(console.log)
```
Expected: `{ error: "..." }` com status 502 (esperado, sem `EVOLUTION_API_URL` configurada ainda — será resolvido na Task 19).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/crm/users/ src/app/api/crm/connection/
git commit -m "feat: adiciona rotas de usuarios e status de conexao do WhatsApp"
```

---

## Task 14: Hooks React Query do CRM

**Files:**
- Create: `src/hooks/crm-api.ts`

- [ ] **Step 1: Criar o arquivo de hooks**

```typescript
// src/hooks/crm-api.ts
'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { LeadStage, CrmTag, CrmUser, Message, WhatsappConnection } from '@/types/crm'

// ——— Stages (board) ———
export function useStages() {
  return useQuery<LeadStage[]>({
    queryKey: ['crm-stages'],
    queryFn: async () => {
      const res = await fetch('/api/crm/stages')
      if (!res.ok) throw new Error('Failed to fetch stages')
      return res.json()
    },
    staleTime: 10_000,
  })
}

export function useCreateStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await fetch('/api/crm/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create stage')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-stages'] }),
  })
}

export function useDeleteStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/stages/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete stage')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-stages'] }),
  })
}

// ——— Lead ———
export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: string; name?: string; stageId?: string; assignedToId?: string | null }) => {
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

// ——— Messages ———
export function useLeadMessages(leadId: string | null) {
  return useQuery<Message[]>({
    queryKey: ['crm-messages', leadId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/leads/${leadId}/messages`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      return res.json()
    },
    enabled: !!leadId,
  })
}

export function useSendMessage(leadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/crm/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send message')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-messages', leadId] })
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
    },
  })
}

// ——— Tags ———
export function useCrmTags() {
  return useQuery<CrmTag[]>({
    queryKey: ['crm-tags'],
    queryFn: async () => {
      const res = await fetch('/api/crm/tags')
      if (!res.ok) throw new Error('Failed to fetch tags')
      return res.json()
    },
    staleTime: 30_000,
  })
}

export function useCreateCrmTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await fetch('/api/crm/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create tag')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-tags'] }),
  })
}

export function useAttachTag(leadId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tagId: string) => {
      const res = await fetch(`/api/crm/leads/${leadId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      })
      if (!res.ok) throw new Error('Failed to attach tag')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-stages'] }),
  })
}

export function useDetachTag(leadId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tagId: string) => {
      const res = await fetch(`/api/crm/leads/${leadId}/tags/${tagId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to detach tag')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-stages'] }),
  })
}

// ——— Users ———
export function useCrmUsers() {
  return useQuery<CrmUser[]>({
    queryKey: ['crm-users'],
    queryFn: async () => {
      const res = await fetch('/api/crm/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      return res.json()
    },
    staleTime: 60_000,
  })
}

// ——— WhatsApp connection ———
export function useConnection() {
  return useQuery<WhatsappConnection>({
    queryKey: ['crm-connection'],
    queryFn: async () => {
      const res = await fetch('/api/crm/connection')
      if (!res.ok) throw new Error('Failed to fetch connection status')
      return res.json()
    },
    refetchInterval: (query) => (query.state.data?.status === 'open' ? false : 5_000),
  })
}

export function useQrCode(enabled: boolean) {
  return useQuery<{ base64?: string }>({
    queryKey: ['crm-qrcode'],
    queryFn: async () => {
      const res = await fetch('/api/crm/connection/qrcode')
      if (!res.ok) throw new Error('Failed to fetch QR code')
      return res.json()
    },
    enabled,
    refetchInterval: enabled ? 20_000 : false,
  })
}

// ——— Realtime (SSE) ———
export function useCrmStream() {
  const qc = useQueryClient()

  useEffect(() => {
    const es = new EventSource('/api/crm/stream')

    es.onmessage = () => {
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['crm-messages'] })
      qc.invalidateQueries({ queryKey: ['crm-connection'] })
    }

    return () => es.close()
  }, [qc])
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro relacionado a `src/hooks/crm-api.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/crm-api.ts
git commit -m "feat: adiciona hooks React Query do CRM"
```

---

## Task 15: UI — Kanban de Leads (board, coluna, card)

**Files:**
- Create: `src/components/crm/kanban-leads.tsx`
- Create: `src/components/crm/lead-column.tsx`
- Create: `src/components/crm/lead-card.tsx`

- [ ] **Step 1: Criar `lead-card.tsx`**

```typescript
// src/components/crm/lead-card.tsx
'use client'

import { useDraggable } from '@dnd-kit/core'
import type { Lead } from '@/types/crm'
import { MessageCircle } from 'lucide-react'

interface LeadCardProps {
  lead: Lead
  onSelect: () => void
}

export function LeadCard({ lead, onSelect }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const lastMessage = lead.messages[0]

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`
        p-3 rounded-xl border cursor-pointer
        ${isDragging
          ? 'opacity-60 scale-[0.98] shadow-2xl shadow-blue-500/10 border-blue-500/20 z-10'
          : 'bg-white/[0.03] border-white/[0.07] hover:border-white/[0.15] hover:bg-white/[0.05]'
        }
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white truncate">{lead.name || lead.phone}</span>
      </div>

      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
        <MessageCircle className="w-3 h-3 shrink-0" />
        <span className="truncate">{lastMessage?.content ?? 'Sem mensagens'}</span>
      </div>

      {lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
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

      {lead.assignedTo && <div className="mt-2 text-[11px] text-slate-500">{lead.assignedTo.name}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Criar `lead-column.tsx`**

```typescript
// src/components/crm/lead-column.tsx
'use client'

import { useDroppable } from '@dnd-kit/core'
import type { LeadStage } from '@/types/crm'
import { LeadCard } from './lead-card'

interface LeadColumnProps {
  stage: LeadStage
  onSelectLead: (id: string) => void
}

export function LeadColumn({ stage, onSelectLead }: LeadColumnProps) {
  const { setNodeRef } = useDroppable({
    id: `stage-droppable-${stage.id}`,
    data: { stageId: stage.id },
  })

  return (
    <div className="flex flex-col w-[330px] shrink-0 rounded-2xl border bg-white/[0.02] border-white/[0.07] hover:border-white/[0.1]">
      <div
        className="p-4 rounded-t-2xl"
        style={{ background: `linear-gradient(to bottom, ${stage.color}26, transparent)` }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white/5" style={{ backgroundColor: stage.color }} />
          <h3 className="text-sm font-semibold text-white tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>
            {stage.name}
          </h3>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-300">
            {stage.leads.length}
          </span>
        </div>
      </div>

      <div ref={setNodeRef} className="flex-1 p-3 space-y-2.5 min-h-[80px] overflow-y-auto max-h-[calc(100vh-280px)]">
        {stage.leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onSelect={() => onSelectLead(lead.id)} />
        ))}

        {stage.leads.length === 0 && (
          <div className="flex items-center justify-center h-20 text-slate-600 text-sm">Nenhum lead</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Criar `kanban-leads.tsx`**

```typescript
// src/components/crm/kanban-leads.tsx
'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useStages, useCreateStage, useUpdateLead, useCrmStream } from '@/hooks/crm-api'
import { LeadColumn } from './lead-column'
import { LeadPanel } from './lead-panel'
import type { Lead } from '@/types/crm'
import { Plus, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

export function KanbanLeads() {
  const { data: stages, isLoading } = useStages()
  const createStage = useCreateStage()
  const updateLead = useUpdateLead()
  useCrmStream()

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [isAddingStage, setIsAddingStage] = useState(false)
  const [newStageName, setNewStageName] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const lead = active.data.current?.lead as Lead | undefined
    const targetStageId = over.data.current?.stageId as string | undefined
    if (!lead || !targetStageId || lead.stageId === targetStageId) return

    updateLead.mutate({ id: lead.id, stageId: targetStageId })
  }

  function handleAddStage() {
    if (newStageName.trim()) {
      const color = STAGE_COLORS[Math.floor(Math.random() * STAGE_COLORS.length)]
      createStage.mutate({ name: newStageName.trim(), color })
      setNewStageName('')
      setIsAddingStage(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="text-sm text-slate-500">Carregando leads...</span>
        </div>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-5 items-start min-h-[calc(100vh-180px)]">
          {(stages || []).map((stage) => (
            <LeadColumn key={stage.id} stage={stage} onSelectLead={setSelectedLeadId} />
          ))}

          {isAddingStage ? (
            <div className="w-[330px] shrink-0 p-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] space-y-3">
              <Input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddStage()
                  if (e.key === 'Escape') {
                    setIsAddingStage(false)
                    setNewStageName('')
                  }
                }}
                placeholder="Nome da etapa..."
                autoFocus
                className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 rounded-xl"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddStage}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs cursor-pointer rounded-lg"
                >
                  Criar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingStage(false)
                    setNewStageName('')
                  }}
                  className="text-slate-500 hover:text-white text-xs cursor-pointer"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingStage(true)}
              className="w-[330px] shrink-0 p-4 rounded-2xl border-2 border-dashed border-white/[0.06] text-slate-500 hover:text-white hover:border-blue-500/30 hover:bg-blue-500/[0.03] cursor-pointer flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus className="w-5 h-5" />
              Nova etapa
            </button>
          )}
        </div>
      </div>

      {selectedLeadId && <LeadPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
    </DndContext>
  )
}
```

> Este passo importa `LeadPanel` de `./lead-panel`, criado na Task 16. É esperado que o build falhe entre as Tasks 15 e 16 — normal, siga para a próxima task antes de testar no navegador.

- [ ] **Step 4: Commit**

```bash
git add src/components/crm/lead-card.tsx src/components/crm/lead-column.tsx src/components/crm/kanban-leads.tsx
git commit -m "feat: adiciona board kanban de leads (coluna e card)"
```

---

## Task 16: UI — Painel do Lead (chat, tags, responsável)

**Files:**
- Create: `src/components/crm/lead-panel.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
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
    if (!draft.trim()) return
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
    <div className="fixed inset-y-0 right-0 w-[420px] bg-[#0a0b10] border-l border-white/[0.08] shadow-2xl shadow-black/40 flex flex-col z-40">
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
        <Button onClick={handleSend} className="bg-blue-600 hover:bg-blue-500 text-white cursor-pointer rounded-lg" size="icon">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos do board completo**

Run: `npx tsc --noEmit`
Expected: nenhum erro em `src/components/crm/*`.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/lead-panel.tsx
git commit -m "feat: adiciona painel lateral do lead com chat, tags e responsavel"
```

---

## Task 17: UI — Configurações de Conexão WhatsApp (QR code)

**Files:**
- Create: `src/components/crm/whatsapp-settings.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
// src/components/crm/whatsapp-settings.tsx
'use client'

import { useState } from 'react'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useConnection, useQrCode } from '@/hooks/crm-api'

export function WhatsappSettings() {
  const [open, setOpen] = useState(false)
  const { data: connection } = useConnection()
  const isConnected = connection?.status === 'open'
  const { data: qrData, isLoading: isLoadingQr } = useQrCode(open && !isConnected)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
          />
        }
      >
        {isConnected ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
        WhatsApp
      </DialogTrigger>
      <DialogContent className="bg-[#0a0b10] border-white/[0.1] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Conexão WhatsApp</DialogTitle>
        </DialogHeader>

        {isConnected ? (
          <div className="flex items-center gap-2 text-emerald-400 text-sm py-6 justify-center">
            <Wifi className="w-5 h-5" /> Conectado
          </div>
        ) : isLoadingQr ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : qrData?.base64 ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <img src={qrData.base64} alt="QR Code WhatsApp" className="w-56 h-56 rounded-xl" />
            <p className="text-xs text-slate-500 text-center">
              Abra o WhatsApp no celular do número dedicado → Configurações → Aparelhos conectados → Conectar um
              aparelho
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-6">Não foi possível carregar o QR code.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro em `src/components/crm/whatsapp-settings.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/whatsapp-settings.tsx
git commit -m "feat: adiciona modal de configuracao e QR code da conexao WhatsApp"
```

---

## Task 18: Aba "CRM" no page.tsx

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Importar o componente, o ícone e expandir o tipo `ActiveTab`**

No topo de `src/app/page.tsx`, ajustar os imports:

```typescript
import { LayoutDashboard, ClipboardList, LogOut, User, BarChart, GraduationCap, Bot, MessageSquare } from 'lucide-react'
import { KanbanLeads } from '@/components/crm/kanban-leads'
import { WhatsappSettings } from '@/components/crm/whatsapp-settings'
```

E o tipo:

```typescript
type ActiveTab = 'kanban' | 'mentoria' | 'tasks' | 'dashboard' | 'automacao-ml' | 'crm'
```

- [ ] **Step 2: Adicionar botão na nav (depois do botão "Automação ML")**

```tsx
<button
  onClick={() => setActiveTab('crm')}
  className={`
    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
    ${activeTab === 'crm'
      ? 'bg-gradient-to-r from-green-600/90 to-lime-600/90 text-white shadow-lg shadow-green-500/20'
      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
    }
  `}
>
  <MessageSquare className="w-4 h-4" />
  CRM
</button>
```

- [ ] **Step 3: Adicionar `WhatsappSettings` na área do usuário (header)**

No `<div className="flex items-center gap-3">` da área de usuário, antes do botão de logout:

```tsx
<WhatsappSettings />
```

- [ ] **Step 4: Renderizar o componente na área de conteúdo**

Depois de `{activeTab === 'automacao-ml' && <AutomacaoMLView />}`:

```tsx
{activeTab === 'crm' && <KanbanLeads />}
```

- [ ] **Step 5: Verificar no navegador**

Run: `npm run dev` (se não estiver rodando)
Abra `http://localhost:3000`, faça login, clique na aba "CRM".
Expected: aparece o board com as 4 etapas do seed; a etapa "Teste" e o lead movido nas Tasks 10/11 também aparecem. Clique no lead → o painel lateral abre com telefone, tags e histórico de mensagens. Arraste o card para outra coluna → ele muda de etapa (confirme recarregando a página).

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: adiciona aba CRM no nav do sistemaMelo"
```

---

## Task 19: Variáveis de Ambiente, Instância Evolution e Verificação Ponta a Ponta

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Adicionar as novas variáveis em `.env.example`**

```
# Evolution API — WhatsApp self-hosted (CRM)
# URL do servidor onde a Evolution API está hospedada
EVOLUTION_API_URL="https://sua-evolution-api.exemplo.com"
# API key global da instância (definida na configuração da Evolution API)
EVOLUTION_API_KEY="troque-por-sua-api-key"
# Nome da instância criada na Evolution API
EVOLUTION_INSTANCE_NAME="sistemamelo"
# Segredo compartilhado para validar o webhook (opcional, mas recomendado)
EVOLUTION_WEBHOOK_SECRET="gere-um-segredo-com-openssl-rand-hex-32"
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: adiciona variaveis de ambiente da Evolution API"
```

- [ ] **Step 3: Provisionar a Evolution API (infraestrutura, fora do código)**

Isso é trabalho de infra, não de código deste repositório — fica documentado aqui para referência de quem for fazer o setup:

1. Hospedar a Evolution API (Docker em uma VPS, Railway, ou outro provedor) — ver documentação oficial da Evolution API para o `docker-compose.yml`.
2. Criar uma instância via `POST {EVOLUTION_API_URL}/instance/create` com `instanceName` igual ao valor de `EVOLUTION_INSTANCE_NAME`.
3. Configurar o webhook da instância para apontar para `https://<seu-dominio-sistemamelo>/api/whatsapp/webhook?secret=<mesmo valor de EVOLUTION_WEBHOOK_SECRET>`, habilitando os eventos `messages.upsert` e `connection.update`.
4. Preencher `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`, `EVOLUTION_WEBHOOK_SECRET` nas variáveis de ambiente da Vercel (produção) e no `.env.local` (desenvolvimento).

- [ ] **Step 4: Verificação ponta a ponta (após a Task 3 estar concluída)**

1. Abrir a aba "CRM" no sistemaMelo, clicar no botão "WhatsApp" no header → deve mostrar o QR code.
2. Escanear o QR code com o WhatsApp do número dedicado.
3. Confirmar que o botão muda para "Conectado" (ícone verde) em até 5 segundos (polling do `useConnection`).
4. Mandar uma mensagem de WhatsApp pessoal para o número dedicado.
5. Confirmar que um novo lead aparece na coluna "Novo Contato" do Kanban, em tempo real (sem precisar recarregar a página).
6. Abrir o lead, responder pelo painel do CRM, e confirmar que a mensagem chega no WhatsApp de verdade.
7. Testar tags: criar uma tag nova com cor customizada e aplicá-la ao lead.
8. Testar responsável: atribuir o lead a um usuário da lista.
9. Arrastar o lead para outra coluna e confirmar que persiste após recarregar.

- [ ] **Step 5: Remover dados de teste (opcional)**

Caso os leads/mensagens de teste das Tasks 7–12 (telefone `5511999999999`, etapa "Teste") não devam ir para produção, removê-los via Prisma Studio antes do deploy final.
