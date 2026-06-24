import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'
import { emitCrmEvent } from '@/lib/crm-events'

const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET ?? ''

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function isAuthorized(request: Request): boolean {
  if (!WEBHOOK_SECRET) return process.env.NODE_ENV !== 'production'
  const headerSecret = request.headers.get('x-webhook-secret')
  if (headerSecret && timingSafeEqualStrings(headerSecret, WEBHOOK_SECRET)) return true
  const { searchParams } = new URL(request.url)
  const querySecret = searchParams.get('secret')
  return !!querySecret && timingSafeEqualStrings(querySecret, WEBHOOK_SECRET)
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

  try {
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
  } catch (error) {
    console.error('Erro ao processar webhook da Evolution API:', error)
  }

  return NextResponse.json({ ok: true })
}
