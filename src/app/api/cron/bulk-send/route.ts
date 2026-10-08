import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCronRequestAuthorized } from '@/lib/cron-auth'
import { sendTextMessage, sendMediaMessage, sendAudioMessage } from '@/lib/evolution-client'
import { prepareWhatsAppVoiceAudio } from '@/lib/audio-converter'

const BATCH_SIZE = 8

export const runtime = 'nodejs'

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

export async function POST(request: Request) {
  if (!(await isCronRequestAuthorized(request))) {
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
  const errors: { name: string; phone: string; error: string }[] = []
  let audioBase64 = campaign.mediaBase64

  if (audioBase64 && campaign.mediaType === 'audio') {
    const preparedAudio = await prepareWhatsAppVoiceAudio({
      buffer: Buffer.from(audioBase64, 'base64'),
      mimeType: campaign.mimeType,
    })
    audioBase64 = preparedAudio.buffer.toString('base64')

    if (preparedAudio.converted || campaign.mimeType !== preparedAudio.mimeType || campaign.fileName !== preparedAudio.fileName) {
      await prisma.bulkCampaign.update({
        where: { id: campaign.id },
        data: {
          mediaBase64: audioBase64,
          mimeType: preparedAudio.mimeType,
          fileName: preparedAudio.fileName,
        },
      })
    }
  }

  for (const item of pending) {
    const phone = item.lead.phone
    try {
      if (audioBase64 && campaign.mediaType === 'audio') {
        await sendAudioMessage(phone, audioBase64)
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
      errors.push({ name: item.lead.name ?? phone, phone, error })
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

  // Conta pendentes restantes para o frontend saber se há mais lotes
  const remaining = await prisma.bulkCampaignLead.count({
    where: { campaignId: campaign.id, status: 'PENDING' },
  })

  return NextResponse.json({ ok: true, sent, failed, remaining, errors })
}

// Vercel Cron também pode usar GET
export const GET = POST
