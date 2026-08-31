import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { fetchGroups } from '@/lib/evolution-client'

/** Rota de uso único: lista os grupos do WhatsApp conectado, pra achar o ID
 *  do grupo certo e configurar a notificação de promoções vencendo. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const groups = await fetchGroups()
    return NextResponse.json(groups)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
