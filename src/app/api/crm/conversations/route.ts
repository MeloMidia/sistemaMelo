import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findLastMessages } from '@/lib/last-messages'

const MAX_CONVERSATIONS = 250

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searchTerm = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  const phoneTerm = searchTerm.replace(/\D/g, '')

  const leads = await prisma.lead.findMany({
    where: searchTerm ? {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        ...(phoneTerm ? [{ phone: { contains: phoneTerm } }] : []),
        {
          messages: {
            some: {
              content: { contains: searchTerm, mode: 'insensitive' },
              NOT: { whatsappMessageId: { startsWith: 'note-' } },
            },
          },
        },
      ],
    } : undefined,
    orderBy: { updatedAt: 'desc' },
    take: MAX_CONVERSATIONS,
    select: {
      id: true,
      name: true,
      phone: true,
      waLid: true,
      profilePicUrl: true,
      updatedAt: true,
      lastReadAt: true,
      stage: { select: { id: true, name: true, color: true } },
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true } },
        },
      },
    },
  })

  const lastByLead = await findLastMessages(leads.map((lead) => lead.id))

  const conversations = leads.map((lead) => {
    const last = lastByLead.get(lead.id)
    const lastMessage = last
      ? { id: last.id, content: last.content, direction: last.direction, status: last.status, createdAt: last.createdAt }
      : null
    const isUnread = Boolean(
      lastMessage?.direction === 'INBOUND' &&
      (!lead.lastReadAt || lastMessage.createdAt > lead.lastReadAt)
    )

    return { ...lead, lastMessage, isUnread }
  })

  // Lead.updatedAt é @updatedAt: marcar como lida, mudar estágio ou etiqueta
  // também o avança, e a conversa subia para o topo sem mensagem nova. A lista
  // segue a última mensagem; o recorte por updatedAt continua valendo, porque
  // toda mensagem nova avança o updatedAt do lead.
  const lastActivity = (conversation: (typeof conversations)[number]) =>
    new Date(conversation.lastMessage?.createdAt ?? conversation.updatedAt).getTime()
  conversations.sort((first, second) => lastActivity(second) - lastActivity(first))

  return NextResponse.json(conversations)
}
