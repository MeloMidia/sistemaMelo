import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ensureCrmPipeline } from '@/lib/crm-pipeline'

const LEADS_PER_STAGE = 100

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureCrmPipeline()

  const stages = await prisma.leadStage.findMany({
    orderBy: { order: 'asc' },
    include: {
      _count: { select: { leads: true } },
      leads: {
        where: { followUpColumn: null },
        take: LEADS_PER_STAGE,
        orderBy: { updatedAt: 'desc' },
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
  })

  return NextResponse.json(stages)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, color } = await request.json()
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Informe o nome da etapa.' }, { status: 400 })
  }

  const lastStage = await prisma.leadStage.findFirst({ orderBy: { order: 'desc' } })
  const newOrder = (lastStage?.order ?? 0) + 1000

  const stage = await prisma.leadStage.create({
    data: { name: name.trim(), color: color || '#3b82f6', order: newOrder },
  })

  return NextResponse.json(stage)
}
