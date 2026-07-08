import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tags = await prisma.crmTag.findMany({
    orderBy: { name: 'asc' },
    include: {
      leads: {
        take: 200,
        orderBy: { lead: { updatedAt: 'desc' } },
        include: {
          lead: {
            include: {
              tags: { include: { tag: true } },
              assignedTo: { select: { id: true, name: true } },
              messages: {
                where: { NOT: { whatsappMessageId: { startsWith: 'note-' } } },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
              _count: {
                select: {
                  messages: {
                    where: { NOT: { whatsappMessageId: { startsWith: 'note-' } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  const columns = tags.map((tag) => {
    const leads = tag.leads
      .map((lt) => lt.lead)
      .sort((a, b) => {
        const aLast = a.messages[0]?.createdAt?.getTime() ?? null
        const bLast = b.messages[0]?.createdAt?.getTime() ?? null
        if (aLast === null && bLast === null) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
        if (aLast === null) return -1
        if (bLast === null) return 1
        return bLast - aLast
      })

    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      leads,
    }
  })

  return NextResponse.json(columns)
}
