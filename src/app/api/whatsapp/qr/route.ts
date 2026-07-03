import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BASE_URL = (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '')
const API_KEY = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = await fetch(`${BASE_URL}/instance/connect/${INSTANCE}`, {
    headers: { apikey: API_KEY },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return NextResponse.json({ error: `Evolution API ${res.status}: ${text.slice(0, 200)}` }, { status: 502 })
  }

  const data = await res.json() as Record<string, unknown>
  // Evolution API v2 returns { base64: "data:image/png;base64,..." } or nested under qrcode
  const base64 =
    (data.base64 as string | undefined) ??
    ((data.qrcode as Record<string, unknown> | undefined)?.base64 as string | undefined)

  if (!base64) return NextResponse.json({ error: 'QR code não disponível', raw: data }, { status: 404 })

  return NextResponse.json({ base64 })
}
