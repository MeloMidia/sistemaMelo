// src/app/api/crm/leads/[id]/messages/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendTextMessage } from '@/lib/evolution-client'
import { emitCrmEvent } from '@/lib/crm-events'
import { randomUUID } from 'crypto'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const messages = await prisma.message.findMany({
    where: { leadId: id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(messages)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { content, internal } = (await request.json()) as { content?: unknown; internal?: unknown }

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return NextResponse.json({ error: 'Lead nao encontrado' }, { status: 404 })

  if (typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })
  }

  const normalizedContent = content.trim()

  if (internal === true) {
    const message = await prisma.message.create({
      data: {
        leadId: lead.id,
        whatsappMessageId: `note-${randomUUID()}`,
        direction: 'OUTBOUND',
        content: `[Nota Interna] ${normalizedContent}`,
        status: null,
      },
    })
    await prisma.lead.update({ where: { id: lead.id }, data: { updatedAt: new Date() } })
    emitCrmEvent({ type: 'new-message', leadId: lead.id, message })
    return NextResponse.json(message)
  }

  if (!checkRateLimit()) {
    return NextResponse.json({ error: 'Limite de envio atingido, aguarde um minuto' }, { status: 429 })
  }

  try {
    const result = await sendTextMessage(lead.phone, normalizedContent)
    const message = await prisma.message.upsert({
      where: { whatsappMessageId: result.key.id },
      create: {
        leadId: lead.id,
        whatsappMessageId: result.key.id,
        direction: 'OUTBOUND',
        content: normalizedContent,
        status: 'SENT',
      },
      update: {
        content: normalizedContent,
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
        content: normalizedContent,
        status: 'FAILED',
      },
    })
    await prisma.lead.update({ where: { id: lead.id }, data: { updatedAt: new Date() } })
    emitCrmEvent({ type: 'new-message', leadId: lead.id, message })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao enviar mensagem' },
      { status: 502 }
    )
  }
}
