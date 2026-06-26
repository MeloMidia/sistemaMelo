import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { emitCrmEvent } from '@/lib/crm-events'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendMediaMessage, type MediaMessageType } from '@/lib/evolution-client'

const MAX_MEDIA_SIZE = 25 * 1024 * 1024

function resolveMediaType(mimeType: string): MediaMessageType {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  return 'document'
}

function mediaLabel(mediaType: MediaMessageType): string {
  if (mediaType === 'image') return 'imagem'
  if (mediaType === 'video') return 'video'
  return 'documento'
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!checkRateLimit()) {
    return NextResponse.json({ error: 'Limite de envio atingido, aguarde um minuto' }, { status: 429 })
  }

  const { id } = await params
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return NextResponse.json({ error: 'Lead nao encontrado' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('file')
  const captionValue = formData.get('caption')
  const caption = typeof captionValue === 'string' ? captionValue.trim() : ''

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo nao enviado' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Arquivo vazio' }, { status: 400 })
  }
  if (file.size > MAX_MEDIA_SIZE) {
    return NextResponse.json({ error: 'Arquivo acima do limite de 25 MB' }, { status: 413 })
  }

  const mediaType = resolveMediaType(file.type || 'application/octet-stream')
  const buffer = Buffer.from(await file.arrayBuffer())
  const content = `[midia enviada - tipo: ${mediaLabel(mediaType)}]`

  try {
    const result = await sendMediaMessage({
      phone: lead.phone,
      mediaType,
      mimeType: file.type || 'application/octet-stream',
      base64Media: buffer.toString('base64'),
      fileName: file.name || `arquivo-${randomUUID()}`,
      caption,
    })

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
      { error: error instanceof Error ? error.message : 'Falha ao enviar arquivo' },
      { status: 502 }
    )
  }
}
