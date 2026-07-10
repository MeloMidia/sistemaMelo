// Configura o webhook na Evolution API apontando para este sistema
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BASE_URL = (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '')
const API_KEY = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!BASE_URL || !API_KEY || !INSTANCE) {
    return NextResponse.json(
      { error: 'Env vars EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME não configuradas.' },
      { status: 400 }
    )
  }

  // Detecta a URL pública deste servidor para montar a URL do webhook
  const { webhookUrl: customUrl } = await request.json().catch(() => ({})) as { webhookUrl?: string }
  const host = request.headers.get('host') ?? ''
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const webhookUrl = customUrl ?? `${proto}://${host}/api/crm/webhook/evolution`

  try {
    const res = await fetch(`${BASE_URL}/webhook/set/${INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: API_KEY,
      },
      body: JSON.stringify({
        url: webhookUrl,
        webhook_by_events: false,
        webhook_base64: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
          'LABELS_ASSOCIATION',
        ],
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        { error: `Evolution API retornou ${res.status}`, detail: data },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, webhookUrl, response: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
