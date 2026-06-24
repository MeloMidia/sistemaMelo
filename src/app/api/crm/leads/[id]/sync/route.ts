import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findMessages } from '@/lib/evolution-client'
import { emitCrmEvent } from '@/lib/crm-events'

function extractMessageText(message: any): string | null {
  if (!message) return null
  if (typeof message.conversation === 'string') return message.conversation
  const extended = message.extendedTextMessage as { text?: string } | undefined
  if (extended?.text) return extended.text
  return null
}

function describeMediaType(message: any): string | null {
  if (!message) return null
  if (message.imageMessage) return 'imagem'
  if (message.audioMessage) return 'áudio'
  if (message.videoMessage) return 'vídeo'
  if (message.documentMessage) return 'documento'
  return null
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  try {
    const rawMessages = await findMessages(lead.phone)
    let importedCount = 0

    // Grouping status codes (1=SENT, 2=DELIVERED, 3=READ, 4=PLAYED/READ)
    const statusMap: Record<number, 'SENT' | 'DELIVERED' | 'READ'> = {
      1: 'SENT',
      2: 'DELIVERED',
      3: 'READ',
      4: 'READ',
    }

    for (const item of rawMessages) {
      if (!item?.key?.id) continue
      
      const whatsappMessageId = item.key.id
      const direction = item.key.fromMe ? 'OUTBOUND' : 'INBOUND'
      
      // Check if message already exists
      const exists = await prisma.message.findUnique({
        where: { whatsappMessageId }
      })
      if (exists) continue

      const messageContent = item.message
      const text = extractMessageText(messageContent)
      const mediaType = text ? null : describeMediaType(messageContent)
      const content = text ?? (mediaType ? `[mídia recebida — tipo: ${mediaType}]` : '[mensagem não suportada]')

      const status = item.key.fromMe ? (statusMap[Number(item.status)] || 'SENT') : null
      const createdAt = item.messageTimestamp ? new Date(Number(item.messageTimestamp) * 1000) : new Date()

      await prisma.message.create({
        data: {
          leadId: lead.id,
          whatsappMessageId,
          direction,
          content,
          status,
          createdAt,
        }
      })
      importedCount++
    }

    if (importedCount > 0) {
      emitCrmEvent({ type: 'new-message', leadId: lead.id, message: {} as any })
    }

    return NextResponse.json({ success: true, imported: importedCount })
  } catch (error: any) {
    console.error('Erro na sincronização de mensagens:', error)
    return NextResponse.json({ error: error.message || 'Erro ao sincronizar mensagens' }, { status: 500 })
  }
}
