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
        include: {
          tags: { include: { tag: true } },
          assignedTo: { select: { id: true, name: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
      },
    },
  })

  // Ordena como lista de conversas do WhatsApp: sem mensagem ainda → topo
  // (ordenados por criação desc), com mensagem → por data da última mensagem desc.
  const sorted = stages.map((stage) => ({
    ...stage,
    leads: [...stage.leads].sort((a, b) => {
      const aLast = a.messages[0]?.createdAt?.getTime() ?? null
      const bLast = b.messages[0]?.createdAt?.getTime() ?? null
      if (aLast === null && bLast === null) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      if (aLast === null) return -1
      if (bLast === null) return 1
      return bLast - aLast
    }),
  }))

  return NextResponse.json(sorted)
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
