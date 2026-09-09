import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { groupDuplicateLeads } from '@/lib/crm-lead-rules'

const MAX_SCAN = 5_000

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leads = await prisma.lead.findMany({
    take: MAX_SCAN,
    orderBy: [{ phone: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      phone: true,
      profilePicUrl: true,
      createdAt: true,
      stage: { select: { id: true, name: true, color: true } },
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { messages: true, tasks: true, events: true, negotiations: true } },
    },
  })

  const groups = groupDuplicateLeads(leads)
  return NextResponse.json({
    scanned: leads.length,
    truncated: leads.length === MAX_SCAN,
    total: groups.length,
    groups,
  })
}

