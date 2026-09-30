import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { daysBetweenDateStrings, toDateOnlyString, todayBrazilDateString } from '@/lib/clientes'
import { getConnectionState, fetchAllGroups } from '@/lib/evolution-client'

/**
 * Rota de uso único: diagnostica por que o aviso de promoção vencendo (que
 * já disparou "notified: 5" com sucesso do lado da Evolution API) pode não
 * ter chegado de fato no grupo — confere se a instância está conectada e se
 * o JID configurado em EVOLUTION_NOTIFY_GROUP_JID bate com algum grupo real
 * que a instância enxerga. Não reenvia a mensagem. Protegida por sessão.
 * Remover depois de usar.
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

  try {
    const groups = await fetchAllGroups()
    out.groupsCount = groups.length
    out.groupMatch = groups.find((g) => g.id === jid) ?? null
    out.groupsSample = groups.slice(0, 15).map((g) => ({ id: g.id, subject: g.subject, size: g.size }))
  } catch (err) {
    out.groupsError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(out)
}
