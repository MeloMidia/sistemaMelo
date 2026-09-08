import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendAudioMessage } from '@/lib/evolution-client'
import { emitCrmEvent } from '@/lib/crm-events'
import { checkRateLimit } from '@/lib/rate-limit'
import { prepareWhatsAppVoiceAudio } from '@/lib/audio-converter'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!checkRateLimit()) {
    return NextResponse.json({ error: 'Limite de envio atingido, aguarde um minuto' }, { status: 429 })
  }

  const { id } = await params
  const [lead, formData] = await Promise.all([
    prisma.lead.findUnique({ where: { id } }),
    request.formData(),
  ])
  if (!lead) return NextResponse.json({ error: 'Lead nao encontrado' }, { status: 404 })

  const file = formData.get('audio')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Arquivo de audio nao enviado' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Arquivo de audio vazio' }, { status: 400 })
  }

  const content = '[midia enviada - tipo: audio]'

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const preparedAudio = await prepareWhatsAppVoiceAudio({
      buffer,
      mimeType: file.type || null,
    })
    const base64Audio = preparedAudio.buffer.toString('base64')
    const result = await sendAudioMessage(lead.phone, base64Audio)
    const message = await prisma.message.upsert({
      where: { whatsappMessageId: result.key.id },
      create: {
        leadId: lead.id,
        whatsappMessageId: result.key.id,
        direction: 'OUTBOUND',
        content,
        status: 'SENT',
      },
      update: {
        content,
        status: 'SENT',
      },
    })
    await prisma.lead.update({ where: { id: lead.id }, data: { updatedAt: new Date() } })
    emitCrmEvent({ type: 'new-message', leadId: lead.id, message })
    return NextResponse.json(message)
  } catch (error) {
    const message = await prisma.message.create({
      data: {
        leadId: lead.id,
        whatsappMessageId: `failed-${randomUUID()}`,
        direction: 'OUTBOUND',
        content,
        status: 'FAILED',
      },
    })
    await prisma.lead.update({ where: { id: lead.id }, data: { updatedAt: new Date() } })
    emitCrmEvent({ type: 'new-message', leadId: lead.id, message })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao enviar audio' },
      { status: 502 }
    )
  }
}
