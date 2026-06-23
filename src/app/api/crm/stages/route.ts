import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stages = await prisma.leadStage.findMany({
    orderBy: { order: 'asc' },
    include: {
      leads: {
        orderBy: { updatedAt: 'desc' },
        include: {
          tags: { include: { tag: true } },
          assignedTo: { select: { id: true, name: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  })

  return NextResponse.json(stages)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, color } = await request.json()

  const lastStage = await prisma.leadStage.findFirst({ orderBy: { order: 'desc' } })
  const newOrder = (lastStage?.order ?? 0) + 1000

  const stage = await prisma.leadStage.create({
    data: { name, color: color || '#3b82f6', order: newOrder },
  })

  return NextResponse.json(stage)
}
