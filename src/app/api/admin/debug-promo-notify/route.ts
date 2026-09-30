import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getConnectionState, sendTextMessage } from '@/lib/evolution-client'

export const maxDuration = 60

/**
 * Rota de uso único: grupo, participantes e conexão já foram confirmados
 * ok num diagnóstico anterior (era só leitura). Só resta confirmar na
 * prática se uma mensagem de verdade chega no grupo "Melo Mídia" — manda
 * um texto bem identificável, autorizado explicitamente pelo usuário.
 * Protegida por sessão. Remover depois de usar.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jid = process.env.EVOLUTION_NOTIFY_GROUP_JID ?? ''
  if (!jid) return NextResponse.json({ error: 'EVOLUTION_NOTIFY_GROUP_JID não configurada' }, { status: 400 })

  const out: Record<string, unknown> = {}

  try {
    out.connection = await getConnectionState()
  } catch (err) {
    out.connectionError = err instanceof Error ? err.message : String(err)
  }

  try {
    const stamp = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const result = await sendTextMessage(jid, `🔧 Teste de diagnóstico — ignorar (${stamp})`)
    out.testMessageSent = { messageId: result.key.id }
  } catch (err) {
    out.testMessageError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(out)
}
