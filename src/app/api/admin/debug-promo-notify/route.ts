import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { daysBetweenDateStrings, toDateOnlyString, todayBrazilDateString } from '@/lib/clientes'
import { getConnectionState, getGroupInfo, fetchInstanceInfo } from '@/lib/evolution-client'

export const maxDuration = 60

/**
 * Rota de uso único: diagnostica por que o aviso de promoção vencendo (que
 * já disparou "notified: 5" com sucesso do lado da Evolution API) pode não
 * ter chegado de fato no grupo. O grupo já foi confirmado como real (nome
 * "Melo Mídia", 8 participantes) — agora checa se o número conectado na
 * instância está de fato entre os participantes desse grupo, já que enviar
 * pra um grupo do qual o número não faz mais parte pode retornar uma
 * mensagem "aceita" localmente sem nunca chegar de verdade. Não manda
 * nenhuma mensagem. Protegida por sessão. Remover depois de usar.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jid = process.env.EVOLUTION_NOTIFY_GROUP_JID ?? ''
  const jidMasked = jid ? `${jid.slice(0, 6)}…${jid.slice(-8)}` : '(vazia)'

  const tasks = await prisma.task.findMany({
    where: { source: 'kanban', promocaoAtiva: true, promocaoAte: { not: null }, churnedAt: null },
    select: { title: true, promocaoAte: true },
  })
  const todayStr = todayBrazilDateString()
  const atRisk = tasks
    .map((t) => {
      const dateStr = toDateOnlyString(t.promocaoAte!)
      return { title: t.title, dateStr, daysLeft: daysBetweenDateStrings(todayStr, dateStr) }
    })
    .filter((t) => t.daysLeft <= 3)

  const out: Record<string, unknown> = { jidMasked, todayStr, tasksAtivos: tasks.length, atRisk }

  try {
    out.connection = await getConnectionState()
  } catch (err) {
    out.connectionError = err instanceof Error ? err.message : String(err)
  }

  let participants: { id: string; phoneNumber: string }[] = []
  if (jid) {
    try {
      const groupInfo = await getGroupInfo(jid) as { participants?: { id: string; phoneNumber: string }[] }
      participants = groupInfo.participants ?? []
      out.groupParticipants = participants.map((p) => p.phoneNumber)
    } catch (err) {
      out.groupInfoError = err instanceof Error ? err.message : String(err)
    }
  }

  try {
    const instanceInfo = await fetchInstanceInfo()
    out.instanceInfo = instanceInfo
    const raw = JSON.stringify(instanceInfo)
    out.instanceIsGroupMember = participants.some((p) => raw.includes(p.phoneNumber.split('@')[0]))
  } catch (err) {
    out.instanceInfoError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(out)
}
