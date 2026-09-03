import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { attachTaskContext, taskLeadInclude } from '@/lib/task-context'

async function getNegotiationTaskBlocklist() {
  const [negotiationTasks, negotiations, negotiationStageLeads] = await Promise.all([
    prisma.task.findMany({
      where: { source: 'negotiations' },
      select: { id: true, leadId: true },
    }),
    prisma.negotiation.findMany({
      select: { taskId: true, leadId: true },
    }),
    prisma.lead.findMany({
      where: { stage: { name: { contains: 'negocia', mode: 'insensitive' } } },
      select: { id: true },
    }),
  ])

  return {
    taskIds: Array.from(new Set([
      ...negotiationTasks.map((task) => task.id),
      ...negotiations.map((negotiation) => negotiation.taskId),
    ])),
    leadIds: Array.from(new Set([
      ...negotiationTasks.map((task) => task.leadId).filter((leadId): leadId is string => Boolean(leadId)),
      ...negotiations.map((negotiation) => negotiation.leadId),
      ...negotiationStageLeads.map((lead) => lead.id),
    ])),
  }
}

async function isLeadInNegotiation(leadId: string) {
  const count = await prisma.lead.count({
    where: {
      id: leadId,
      OR: [
        { negotiations: { some: {} } },
        { tasks: { some: { source: 'negotiations' } } },
        { stage: { name: { contains: 'negocia', mode: 'insensitive' } } },
      ],
    },
  })

  return count > 0
}

function withoutNegotiationLinks(baseWhere: Record<string, unknown>, blocklist: { taskIds: string[]; leadIds: string[] }) {
  const blockedLinks = [
    blocklist.taskIds.length > 0 ? { kanbanTaskId: { in: blocklist.taskIds } } : null,
    blocklist.leadIds.length > 0 ? { leadId: { in: blocklist.leadIds } } : null,
  ].filter(Boolean)

  if (blockedLinks.length === 0) return baseWhere
  return { ...baseWhere, NOT: blockedLinks }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('leadId')
  const kanbanTaskId = searchParams.get('kanbanTaskId')

  if (leadId) {
    if (await isLeadInNegotiation(leadId)) {
      return NextResponse.json([])
    }

    const tasks = await prisma.task.findMany({
      where: { leadId, source: 'tasks' } as object,
      orderBy: { createdAt: 'desc' },
      include: taskLeadInclude,
    })
    return NextResponse.json(await attachTaskContext(tasks))
  }

  if (kanbanTaskId) {
    const parentTask = await prisma.task.findUnique({
      where: { id: kanbanTaskId },
      select: { source: true },
    })

    if (parentTask?.source === 'negotiations') {
      return NextResponse.json([])
    }

    const tasks = await prisma.task.findMany({
      where: { kanbanTaskId, source: 'tasks' } as object,
      orderBy: { createdAt: 'desc' },
      include: taskLeadInclude,
    })
    return NextResponse.json(await attachTaskContext(tasks))
  }

  const negotiationBlocklist = await getNegotiationTaskBlocklist()
  const tasks = await prisma.task.findMany({
    where: withoutNegotiationLinks({ completedAt: null, source: 'tasks' }, negotiationBlocklist) as object,
    orderBy: { createdAt: 'asc' },
    include: taskLeadInclude,
  })

  return NextResponse.json(await attachTaskContext(tasks))
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description, dueDate, isPriorityToday, columnId, logoUrl, source, assignee, isWaiting, meetingsCount, leadId, kanbanTaskId } = await request.json()
  const taskSource = source || 'tasks'

  if (taskSource === 'tasks' && kanbanTaskId) {
    const parentTask = await prisma.task.findUnique({
      where: { id: kanbanTaskId },
      select: { source: true },
    })

    if (parentTask?.source === 'negotiations') {
      return NextResponse.json({ error: 'Tarefas não são criadas para leads em negociação.' }, { status: 400 })
    }
  }

  if (taskSource === 'tasks' && leadId && await isLeadInNegotiation(leadId)) {
    return NextResponse.json({ error: 'Tarefas não são criadas para leads em negociação.' }, { status: 400 })
  }

  // Get max order inside column
  const lastTask = await prisma.task.findFirst({
    where: { columnId },
    orderBy: { order: 'desc' },
  })

  const newOrder = (lastTask?.order || 0) + 1000

  try {
    const task = await prisma.task.create({
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        isPriorityToday: isPriorityToday || false,
        isWaiting: isWaiting || false,
        columnId,
        order: newOrder,
        logoUrl: logoUrl || null,
        source: taskSource,
        assignee: assignee || null,
        meetingsCount: meetingsCount || 0,
        leadId: leadId || null,
        kanbanTaskId: kanbanTaskId || null,
      },
      include: taskLeadInclude,
    })
    const [taskWithContext] = await attachTaskContext([task])
    return NextResponse.json(taskWithContext)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[POST /api/tasks] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
