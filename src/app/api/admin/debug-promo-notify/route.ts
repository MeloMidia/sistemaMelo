import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPromoExpirations } from '@/lib/promo-notify'
import { daysBetweenDateStrings, toDateOnlyString, todayBrazilDateString } from '@/lib/clientes'

/**
 * Rota de uso único: roda checkPromoExpirations() fora do try/catch que o
 * cron usa pra nunca quebrar o envio de campanha — aqui o erro real (se
 * houver) aparece na resposta, em vez de só no log do servidor.
 * Protegida por sessão. Remover depois de usar.
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

  try {
    const result = await checkPromoExpirations()
    return NextResponse.json({ ok: true, jidMasked, todayStr, tasksAtivos: tasks.length, atRisk, result })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      jidMasked,
      todayStr,
      tasksAtivos: tasks.length,
      atRisk,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
