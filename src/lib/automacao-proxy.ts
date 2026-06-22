import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

const BASE_URL = (process.env.AUTOMACAO_ML_URL ?? '').replace(/\/$/, '')
const API_KEY  = process.env.AUTOMACAO_ML_API_KEY ?? ''

/** Verifica sessão next-auth. Retorna NextResponse 401 se não autenticado. */
export async function requireAuth(): Promise<null | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}

/** Chama o FastAPI com X-API-Key. Retorna o Response cru. */
export function fastapiRequest(path: string, init?: RequestInit): Promise<Response> {
  if (!BASE_URL || !API_KEY) {
    return Promise.reject(new Error('Env vars AUTOMACAO_ML_URL e AUTOMACAO_ML_API_KEY não configuradas no servidor.'))
  }
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
  })
}

/** Converte Response do FastAPI em NextResponse preservando o status code. */
export async function proxyJson(res: Response): Promise<NextResponse> {
  const data = await res.json().catch(() => ({ error: 'Resposta inválida do servidor.' }))
  return NextResponse.json(data, { status: res.status })
}
