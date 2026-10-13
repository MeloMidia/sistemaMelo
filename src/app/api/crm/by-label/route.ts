import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findLastMessages } from '@/lib/last-messages'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const LEADS_PER_TAG = 50

  const tags = await prisma.crmTag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { leads: true } } },
  })

  // Leads de cada etiqueta numa consulta própria: `take` aninhado em `include`
  // não vira LIMIT no SQL (traria todos os leads de todas as etiquetas).
  const leadTagsByTag = await Promise.all(tags.map((tag) => prisma.leadTag.findMany({
    where: { tagId: tag.id },
    take: LEADS_PER_TAG,
    orderBy: { lead: { updatedAt: 'desc' } },
    include: {
      lead: {
        include: {
          tags: { include: { tag: true } },
          assignedTo: { select: { id: true, name: true } },
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
  })))

  const lastByLead = await findLastMessages([...new Set(leadTagsByTag.flat().map((lt) => lt.leadId))])

  const columns = tags.map((tag, index) => {
    const leads = leadTagsByTag[index]
      .map((lt) => {
        const last = lastByLead.get(lt.lead.id)
        return { ...lt.lead, messages: last ? [last] : [] }
      })
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
      _count: { leads: tag._count.leads },
    }
  })

  return NextResponse.json(columns)
}
