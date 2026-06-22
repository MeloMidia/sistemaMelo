import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

const BASE_URL = process.env.AUTOMACAO_ML_URL ?? ''
const API_KEY  = process.env.AUTOMACAO_ML_API_KEY ?? ''

/** Verifica sessão next-auth. Retorna NextResponse 401 se não autenticado. */
export async function requireAuth(): Promise<null | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}

/** Chama o FastAPI com X-API-Key. Retorna o Response cru. */
export function fastapiRequest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...(init?.headers ?? {}),
    },
  })
}
