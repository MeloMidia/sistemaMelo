import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { emitCrmEvent } from '@/lib/crm-events'
import {
  applyWhatsappMessageStatus,
  applyLabelAssociation,
  extractPayloadList,
  importWhatsappMessage,
  normalizeEvolutionEvent,
} from '@/lib/whatsapp-sync'

const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

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

  const bearerSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (bearerSecret && timingSafeEqualStrings(bearerSecret, WEBHOOK_SECRET)) return true

  const { searchParams } = new URL(request.url)
  const querySecret = searchParams.get('secret')
  return !!querySecret && timingSafeEqualStrings(querySecret, WEBHOOK_SECRET)
}

function isExpectedInstance(body: Record<string, unknown>): boolean {
  if (!INSTANCE) return true
  const instance = typeof body.instance === 'string' ? body.instance : null
  return !instance || instance === INSTANCE
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

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    if (!isExpectedInstance(body)) return NextResponse.json({ ok: true, ignored: 'instance' })

    const event = normalizeEvolutionEvent(body.event)
    const data = body.data ?? {}

    if (event === 'messages.upsert' || event === 'messages.set') {
      const results = await Promise.all(extractPayloadList(data).map((item) => importWhatsappMessage(item)))
      for (const result of results) {
        if (result) emitCrmEvent({ type: 'new-message', leadId: result.lead.id, message: result.message })
      }
    } else if (event === 'messages.update') {
      const updates = await Promise.all(extractPayloadList(data).map((item) => applyWhatsappMessageStatus(item)))
      for (const message of updates) {
        if (message) emitCrmEvent({ type: 'new-message', leadId: message.leadId, message })
      }
    } else if (event === 'connection.update') {
      await handleConnectionUpdate((data ?? {}) as Record<string, unknown>)
    } else if (event === 'labels.association') {
      await applyLabelAssociation(data)
      emitCrmEvent({ type: 'connection-update', status: 'label-sync' })
    }
  } catch (error) {
    console.error('Erro ao processar webhook da Evolution API:', error)
  }

  return NextResponse.json({ ok: true })
}
