import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendTextMessage, sendMediaMessage, sendAudioMessage } from '@/lib/evolution-client'

const CRON_SECRET = process.env.CRON_SECRET ?? ''
const BATCH_SIZE = 8

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  const vercelCron = request.headers.get('x-vercel-cron-signature')
  const session = await getServerSession(authOptions)

  const authed =
    session ||
    (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) ||
    (!CRON_SECRET && vercelCron) ||
    process.env.NODE_ENV !== 'production'

  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Aceita campaignId opcional para disparar campanha específica
  let targetId: string | undefined
  try {
    const body = await request.json()
    targetId = body.campaignId
  } catch { /* sem body — cron ou GET */ }

  // Busca a campanha alvo
  let campaign = targetId
    ? await prisma.bulkCampaign.findFirst({
        where: { id: targetId, status: { in: ['RUNNING', 'SCHEDULED'] } },
      })
    : await prisma.bulkCampaign.findFirst({
        where: { status: 'RUNNING' },
        orderBy: { scheduledAt: 'asc' },
      }) ?? await prisma.bulkCampaign.findFirst({
        where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
        orderBy: { scheduledAt: 'asc' },
      })

  if (!campaign) {
    return NextResponse.json({ ok: true, message: 'Nada para processar' })
  }

  // Marca como RUNNING se ainda estava SCHEDULED
  if (campaign.status === 'SCHEDULED') {
    campaign = await prisma.bulkCampaign.update({
      where: { id: campaign.id },
      data: { status: 'RUNNING', startedAt: new Date() },
    })
  }

  // Busca próximos leads pendentes
  const pending = await prisma.bulkCampaignLead.findMany({
    where: { campaignId: campaign.id, status: 'PENDING' },
    take: BATCH_SIZE,
    orderBy: { id: 'asc' },
    include: { lead: { select: { phone: true, name: true } } },
  })

  if (pending.length === 0) {
    await prisma.bulkCampaign.update({
      where: { id: campaign.id },
      data: { status: 'DONE', completedAt: new Date() },
    })
    return NextResponse.json({ ok: true, message: 'Campanha concluída' })
  }

  let sent = 0
  let failed = 0

  for (const item of pending) {
    const phone = item.lead.phone
    try {
      if (campaign.mediaBase64 && campaign.mediaType === 'audio') {
        await sendAudioMessage(phone, campaign.mediaBase64)
        if (campaign.message?.trim()) {
          await sleep(1500)
          await sendTextMessage(phone, campaign.message)
        }
      } else if (campaign.mediaBase64 && campaign.mediaType && campaign.mimeType && campaign.fileName) {
        await sendMediaMessage({
          phone,
          mediaType: campaign.mediaType as 'image' | 'video' | 'document',
          mimeType: campaign.mimeType,
          base64Media: campaign.mediaBase64,
          fileName: campaign.fileName,
          caption: campaign.mediaCaption ?? campaign.message ?? '',
        })
        if (campaign.message?.trim() && campaign.message !== campaign.mediaCaption) {
          await sleep(1500)
          await sendTextMessage(phone, campaign.message)
        }
      } else if (campaign.message) {
        await sendTextMessage(phone, campaign.message)
      }

      await prisma.bulkCampaignLead.update({
        where: { id: item.id },
        data: { status: 'SENT', sentAt: new Date() },
      })
      sent++
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Erro desconhecido'
      await prisma.bulkCampaignLead.update({
        where: { id: item.id },
        data: { status: 'FAILED', error },
      })
      failed++
    }

    if (item !== pending[pending.length - 1]) {
      await sleep((campaign.delaySeconds ?? 7) * 1000)
    }
  }

  await prisma.bulkCampaign.update({
    where: { id: campaign.id },
    data: {
      sentCount: { increment: sent },
      failedCount: { increment: failed },
    },
  })

  return NextResponse.json({ ok: true, sent, failed, remaining: pending.length - sent - failed })
}

// Vercel Cron também pode usar GET
export const GET = POST
