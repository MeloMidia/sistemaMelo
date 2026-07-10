// POST /api/cron/bulk-send
// Chamado pelo Vercel Cron a cada minuto.
// Processa um batch de leads pendentes da campanha ativa.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTextMessage, sendMediaMessage } from '@/lib/evolution-client'

const CRON_SECRET = process.env.CRON_SECRET ?? ''
const BATCH_SIZE = 8 // mensagens por execução (com delay de 7s → ~56s total)

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

export async function POST(request: Request) {
  // Autenticação do cron
  const auth = request.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Vercel Cron envia header x-vercel-cron-signature — aceitar mesmo sem secret
  const vercelCron = request.headers.get('x-vercel-cron-signature')
  if (!CRON_SECRET && !vercelCron && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Busca campanha RUNNING ou SCHEDULED que já passou do horário
  let campaign = await prisma.bulkCampaign.findFirst({
    where: { status: 'RUNNING' },
    orderBy: { scheduledAt: 'asc' },
  })

  if (!campaign) {
    campaign = await prisma.bulkCampaign.findFirst({
      where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: 'asc' },
    })
    if (!campaign) return NextResponse.json({ ok: true, message: 'Nada para processar' })

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
    // Campanha concluída
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
      if (campaign.mediaBase64 && campaign.mediaType && campaign.mimeType && campaign.fileName) {
        // Envia mídia (imagem ou vídeo)
        await sendMediaMessage({
          phone,
          mediaType: campaign.mediaType as 'image' | 'video' | 'document',
          mimeType: campaign.mimeType,
          base64Media: campaign.mediaBase64,
          fileName: campaign.fileName,
          caption: campaign.mediaCaption ?? campaign.message ?? '',
        })
        // Se tiver texto além da legenda, envia como mensagem separada
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

    // Delay entre envios para evitar ban
    if (item !== pending[pending.length - 1]) {
      await sleep((campaign.delaySeconds ?? 7) * 1000)
    }
  }

  // Atualiza contadores
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
