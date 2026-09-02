import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const NEGOTIATIONS_SOURCE = 'negotiations'
const NEGOTIATION_STAGES = ['Não atribuídas', 'Em negociação', 'Ganho', 'Perdido']

async function ensureNegotiationBoard() {
  const existingCount = await prisma.column.count({ where: { source: NEGOTIATIONS_SOURCE } })
  if (existingCount > 0) return

  await prisma.column.createMany({
    data: NEGOTIATION_STAGES.map((title, index) => ({
      title,
      order: (index + 1) * 1000,
      source: NEGOTIATIONS_SOURCE,
    })),
  })
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source') || 'kanban'

  if (source === NEGOTIATIONS_SOURCE) await ensureNegotiationBoard()

  const columns = await prisma.column.findMany({
    where: { source },
    include: {
      tasks: {
        where: { source },
        orderBy: { order: 'asc' },
        include: source === NEGOTIATIONS_SOURCE
          ? { negotiation: { select: { negotiatedAt: true, expectedCloseAt: true, totalValue: true } } }
          : undefined,
      },
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(columns)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, source } = await request.json()
  const columnSource = source || 'kanban'

  // Get max order for this source
  const lastColumn = await prisma.column.findFirst({
    where: { source: columnSource } as object,
    orderBy: { order: 'desc' },
  })

  const newOrder = (lastColumn?.order || 0) + 1000

  const column = await prisma.column.create({
    data: {
      title,
      order: newOrder,
      source: columnSource,
    },
  })

  return NextResponse.json(column)
}
