import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { withLastMessage } from '@/lib/last-messages'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leads = await withLastMessage(await prisma.lead.findMany({
    where: { followUpColumn: { not: null } },
    orderBy: { updatedAt: 'desc' },
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
  }))

  const columns = Array.from({ length: 14 }, (_, i) => {
    const col = i + 1
    const colLeads = leads.filter((l) => l.followUpColumn === col)
    return {
      column: col,
      leads: colLeads,
      _count: { leads: colLeads.length },
    }
  })

  return NextResponse.json(columns)
}
