import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { attachTaskContext, isNegotiationRelatedTask, taskLeadInclude } from '@/lib/task-context'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('leadId')
  const kanbanTaskId = searchParams.get('kanbanTaskId')

  if (leadId) {
    const tasks = await prisma.task.findMany({
      where: { leadId, source: 'tasks' } as object,
      orderBy: { createdAt: 'desc' },
      include: taskLeadInclude,
    })
    return NextResponse.json(await attachTaskContext(tasks))
  }

  if (kanbanTaskId) {
    const tasks = await prisma.task.findMany({
      where: { kanbanTaskId, source: 'tasks' } as object,
      orderBy: { createdAt: 'desc' },
      include: taskLeadInclude,
    })
    return NextResponse.json(await attachTaskContext(tasks))
  }

  const tasks = await prisma.task.findMany({
    where: { completedAt: null, source: 'tasks' } as object,
    orderBy: { createdAt: 'asc' },
    include: taskLeadInclude,
  })

  const tasksWithContext = await attachTaskContext(tasks)
  return NextResponse.json(tasksWithContext.filter((task) => !isNegotiationRelatedTask(task)))
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description, dueDate, isPriorityToday, columnId, logoUrl, source, assignee, isWaiting, meetingsCount, leadId, kanbanTaskId } = await request.json()
  const taskSource = source || 'tasks'

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
