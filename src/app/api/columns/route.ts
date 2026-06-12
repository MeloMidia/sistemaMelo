import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source') || 'kanban'

  const columns = await prisma.column.findMany({
    where: { source } as object,
    include: {
      tasks: {
        where: { source } as object,
        orderBy: { order: 'asc' },
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
    } as any,
  })

  return NextResponse.json(column)
}
