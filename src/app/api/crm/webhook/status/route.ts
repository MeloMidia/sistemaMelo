import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEvolutionBaseUrl } from '@/lib/evolution-url'

const BASE_URL = getEvolutionBaseUrl()
const API_KEY = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!BASE_URL || !API_KEY || !INSTANCE) {
    return NextResponse.json({ error: 'Env vars não configuradas' }, { status: 400 })
  }

  const host = request.headers.get('host') ?? ''
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const expectedUrl = `${proto}://${host}/api/crm/webhook/evolution`

  try {
    const res = await fetch(`${BASE_URL}/webhook/find/${INSTANCE}`, {
      headers: { apikey: API_KEY },
    })
    const data = await res.json().catch(() => ({}))

    const webhook = data?.webhook ?? data
    const currentUrl: string = webhook?.url ?? webhook?.webhookUrl ?? ''
    const enabled: boolean = webhook?.enabled ?? false
    const isCorrect = currentUrl === expectedUrl

    return NextResponse.json({ currentUrl, expectedUrl, enabled, isCorrect })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
