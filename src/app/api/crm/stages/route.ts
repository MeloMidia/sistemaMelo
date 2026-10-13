import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ensureCrmPipeline, isClosedCrmStage } from '@/lib/crm-pipeline'
import { withLastMessage } from '@/lib/last-messages'

const LEADS_PER_STAGE = 100

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureCrmPipeline()

  const stages = await prisma.leadStage.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { leads: true } } },
  })

  // Leads de cada etapa numa consulta própria: `take` aninhado em `include`
  // não vira LIMIT no SQL (o Prisma traria todos os leads de todas as etapas,
  // com as mensagens de todos, e cortaria em memória).
  const leadsByStage = await Promise.all(stages.map((stage) => prisma.lead.findMany({
    where: { stageId: stage.id, followUpColumn: null },
    take: LEADS_PER_STAGE,
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
  })))

  const leadsWithLastMessage = await withLastMessage(leadsByStage.flat())
  const leadById = new Map(leadsWithLastMessage.map((lead) => [lead.id, lead]))

  return NextResponse.json(stages.map((stage, index) => ({
    ...stage,
    leads: leadsByStage[index].map((lead) => leadById.get(lead.id)!),
  })))
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

  const stageName = name.trim()
  const stage = await prisma.leadStage.create({
    data: {
      name: stageName,
      color: color || '#3b82f6',
      order: newOrder,
      isClosed: isClosedCrmStage(stageName),
    },
  })

  return NextResponse.json(stage)
}
