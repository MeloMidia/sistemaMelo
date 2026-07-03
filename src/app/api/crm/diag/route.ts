// Endpoint temporário de diagnóstico — remover após o uso
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BASE_URL = (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '')
const API_KEY  = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

async function probe(path: string, init?: RequestInit) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', apikey: API_KEY, ...(init?.headers ?? {}) },
    })
    const text = await res.text()
    let body: unknown
    try { body = JSON.parse(text) } catch { body = text }
    return { status: res.status, ok: res.ok, body }
  } catch (e) {
    return { status: 0, ok: false, body: String(e) }
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    root,
    version,
    instances,
    labels,
    contacts,
    chats,
  ] = await Promise.all([
    probe(`/`),
    probe(`/version`),
    probe(`/instance/fetchInstances`),
    probe(`/label/findLabels/${INSTANCE}`),
    probe(`/chat/findContacts/${INSTANCE}`, { method: 'POST', body: JSON.stringify({ where: {} }) }),
    probe(`/chat/fetchChats/${INSTANCE}`, { method: 'POST', body: JSON.stringify({}) }),
  ])

  return NextResponse.json({
    config: {
      BASE_URL: BASE_URL || '(não configurado)',
      INSTANCE: INSTANCE || '(não configurado)',
      API_KEY_SET: !!API_KEY,
    },
    probes: { root, version, instances, labels, contacts, chats },
  }, { status: 200 })
}
