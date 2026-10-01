import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEvolutionBaseUrl } from '@/lib/evolution-url'

/**
 * Rota de uso único: só leitura — revela o domínio onde a Evolution API
 * está hospedada (sem expor API key nem URL completa), pra ajudar a achar
 * a plataforma de hospedagem e reiniciar a instância por lá. Protegida por
 * sessão. Remover depois de usar.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const base = getEvolutionBaseUrl()
  let host = '(não configurada)'
  try {
    host = base ? new URL(base).host : host
  } catch {
    host = '(URL inválida)'
  }

  return NextResponse.json({ host })
}
