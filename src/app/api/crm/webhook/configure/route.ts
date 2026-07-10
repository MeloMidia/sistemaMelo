// Configura o webhook na Evolution API apontando para este sistema
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BASE_URL = (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '')
const API_KEY = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

const EVENTS = [
  'APPLICATION_STARTUP',
  'QRCODE_UPDATED',
  'MESSAGES_SET',
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'MESSAGES_DELETE',
  'SEND_MESSAGE',
  'CONTACTS_SET',
  'CONTACTS_UPSERT',
  'CONTACTS_UPDATE',
  'PRESENCE_UPDATE',
  'CHATS_SET',
  'CHATS_UPSERT',
  'CHATS_UPDATE',
  'CHATS_DELETE',
  'GROUPS_UPSERT',
  'GROUP_UPDATE',
  'GROUP_PARTICIPANTS_UPDATE',
  'CONNECTION_UPDATE',
  'LABELS_EDIT',
  'LABELS_ASSOCIATION',
  'CALL',
  'NEW_JWT_TOKEN',
]

async function trySetWebhook(url: string, webhookUrl: string) {
  // Tenta o formato v2 primeiro (campo "webhook" aninhado)
  const payloadV2 = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events: EVENTS,
    },
  }

  const resV2 = await fetch(`${url}/webhook/set/${INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: API_KEY },
    body: JSON.stringify(payloadV2),
  })

  if (resV2.ok) {
    const data = await resV2.json().catch(() => ({}))
    return { ok: true, format: 'v2', data }
  }

  const errV2 = await resV2.json().catch(() => ({}))

  // Tenta o formato v1 (campos diretos)
  const payloadV1 = {
    url: webhookUrl,
    webhook_by_events: false,
    webhook_base64: false,
    events: EVENTS,
  }

  const resV1 = await fetch(`${url}/webhook/set/${INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: API_KEY },
    body: JSON.stringify(payloadV1),
  })

  if (resV1.ok) {
    const data = await resV1.json().catch(() => ({}))
    return { ok: true, format: 'v1', data }
  }

  const errV1 = await resV1.json().catch(() => ({}))

  return {
    ok: false,
    errV2: { status: resV2.status, body: errV2 },
    errV1: { status: resV1.status, body: errV1 },
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!BASE_URL || !API_KEY || !INSTANCE) {
    return NextResponse.json(
      { error: 'Env vars EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME não configuradas.' },
      { status: 400 }
    )
  }

  const { webhookUrl: customUrl } = await request.json().catch(() => ({})) as { webhookUrl?: string }
  const host = request.headers.get('host') ?? ''
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const webhookUrl = customUrl ?? `${proto}://${host}/api/crm/webhook/evolution`

  try {
    const result = await trySetWebhook(BASE_URL, webhookUrl)

    if (!result.ok) {
      return NextResponse.json(
        {
          error: 'Evolution API rejeitou os dois formatos de payload',
          webhookUrl,
          detail: { v2: result.errV2, v1: result.errV1 },
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, webhookUrl, format: result.format, response: result.data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET retorna apenas a URL do webhook para configuração manual
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const host = request.headers.get('host') ?? ''
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const webhookUrl = `${proto}://${host}/api/crm/webhook/evolution`

  return NextResponse.json({ webhookUrl, instance: INSTANCE, configured: !!(BASE_URL && API_KEY && INSTANCE) })
}
