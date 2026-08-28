// Configura o webhook na Evolution API apontando para este sistema
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEvolutionBaseUrl } from '@/lib/evolution-url'

const BASE_URL = getEvolutionBaseUrl()
const API_KEY = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

const EVENTS = [
  'APPLICATION_STARTUP',
  'QRCODE_UPDATED',
  'MESSAGES_SET',
  'MESSAGES_UPSERT',
  'MESSAGES_EDITED',
  'MESSAGES_UPDATE',
  'MESSAGES_DELETE',
  'SEND_MESSAGE',
  'SEND_MESSAGE_UPDATE',
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
]

async function trySetWebhook(url: string, webhookUrl: string) {
  const payload = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events: EVENTS,
    },
  }

  const res = await fetch(`${url}/webhook/set/${INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: API_KEY },
    body: JSON.stringify(payload),
  })

  if (res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: true, data }
  }

  const err = await res.json().catch(() => ({}))
  return { ok: false, err: { status: res.status, body: err } }
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
        { error: 'Evolution API rejeitou a requisição', webhookUrl, detail: result.err },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, webhookUrl, response: result.data })
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
