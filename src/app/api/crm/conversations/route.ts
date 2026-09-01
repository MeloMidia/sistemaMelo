import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchWhatsappTags } from '@/lib/wa-tags'

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
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true } },
        },
      },
      messages: {
        where: { NOT: { whatsappMessageId: { startsWith: 'note-' } } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          content: true,
          direction: true,
          status: true,
          createdAt: true,
        },
      },
    },
  })

  const whatsappTagsByLeadId = await fetchWhatsappTags(leads)

  return NextResponse.json(leads.map((lead) => {
    const lastMessage = lead.messages[0] ?? null
    const isUnread = Boolean(
      lastMessage?.direction === 'INBOUND' &&
      (!lead.lastReadAt || lastMessage.createdAt > lead.lastReadAt)
    )

    const fallbackTags = whatsappTagsByLeadId.get(lead.id) ?? []
    const storedTagIds = new Set(lead.tags.map((entry) => entry.tagId))
    const tags = [
      ...lead.tags,
      ...fallbackTags.filter((entry) => !storedTagIds.has(entry.tagId)),
    ]

    return { ...lead, tags, lastMessage, isUnread, messages: undefined }
  }))
}
