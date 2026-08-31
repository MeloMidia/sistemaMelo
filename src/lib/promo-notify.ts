import { prisma } from '@/lib/prisma'
import { sendTextMessage } from '@/lib/evolution-client'
import { daysBetweenDateStrings, toDateOnlyString, todayBrazilDateString } from '@/lib/clientes'

const NOTIFY_GROUP_JID = process.env.EVOLUTION_NOTIFY_GROUP_JID ?? ''
const DAYS_AHEAD = 3

/**
 * Verifica promoções ativas vencendo em até DAYS_AHEAD dias (ou já vencidas)
 * e manda um aviso único, consolidando todos os clientes, pro grupo do
 * WhatsApp configurado em EVOLUTION_NOTIFY_GROUP_JID. Roda dentro do cron
 * diário já existente (/api/cron/bulk-send) — não tem controle de "já avisei",
 * então repete todo dia enquanto a promoção continuar ativa e na janela.
 */
export async function checkPromoExpirations(): Promise<{ notified: number; skipped?: string }> {
  if (!NOTIFY_GROUP_JID) {
    return { notified: 0, skipped: 'EVOLUTION_NOTIFY_GROUP_JID não configurada' }
  }

  const tasks = await prisma.task.findMany({
    where: {
      source: 'kanban',
      promocaoAtiva: true,
      promocaoAte: { not: null },
      churnedAt: null,
    },
    select: { title: true, promocaoAte: true },
  })

  const todayStr = todayBrazilDateString()

  const atRisk = tasks
    .map((t) => {
      const dateStr = toDateOnlyString(t.promocaoAte!)
      return { title: t.title, dateStr, daysLeft: daysBetweenDateStrings(todayStr, dateStr) }
    })
    .filter((t) => t.daysLeft <= DAYS_AHEAD)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  if (atRisk.length === 0) return { notified: 0 }

  const lines = atRisk.map((t) => {
    const [y, m, d] = t.dateStr.split('-')
    const dateBr = `${d}/${m}/${y}`
    const status =
      t.daysLeft < 0 ? `venceu há ${Math.abs(t.daysLeft)} dia(s)` :
      t.daysLeft === 0 ? 'vence hoje' :
      `vence em ${t.daysLeft} dia(s)`
    return `• *${t.title}* — ${status} (${dateBr})`
  })

  const message = [
    '⚠️ *PromoADS — promoções vencendo*',
    '',
    ...lines,
    '',
    'Verificar renovação no sistema.',
  ].join('\n')

  await sendTextMessage(NOTIFY_GROUP_JID, message)

  return { notified: atRisk.length }
}
