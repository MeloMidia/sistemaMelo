import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const events = await prisma.agendaEvent.findMany({
    where: { leadId: id },
    orderBy: { startsAt: 'desc' },
    include: { category: { select: { id: true, name: true, color: true } } },
  })

  return NextResponse.json(events)
}
