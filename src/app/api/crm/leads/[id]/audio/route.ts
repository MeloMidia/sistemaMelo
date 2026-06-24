import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendAudioMessage } from '@/lib/evolution-client'
import { emitCrmEvent } from '@/lib/crm-events'
import { checkRateLimit } from '@/lib/rate-limit'
import { randomUUID } from 'crypto'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!checkRateLimit()) {
    return NextResponse.json({ error: 'Limite de envio atingido, aguarde um minuto' }, { status: 429 })
  }

  const { id } = await params
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('audio')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Arquivo de áudio não enviado' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Arquivo de áudio vazio' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64Audio = buffer.toString('base64')
  const content = '[mídia enviada — tipo: áudio]'

  try {
    const result = await sendAudioMessage(lead.phone, base64Audio)
    const message = await prisma.message.create({
      data: {
        leadId: lead.id,
        whatsappMessageId: result.key.id,
        direction: 'OUTBOUND',
        content,
        status: 'SENT',
      },
    })
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
    emitCrmEvent({ type: 'new-message', leadId: lead.id, message })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao enviar áudio' },
      { status: 502 }
    )
  }
}
