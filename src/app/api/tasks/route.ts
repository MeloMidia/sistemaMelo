import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('leadId')

  if (leadId) {
    // Tarefas de um lead específico (ativas + concluídas)
    const tasks = await prisma.task.findMany({
      where: { leadId, source: 'tasks' } as object,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(tasks)
  }

  const tasks = await prisma.task.findMany({
    where: { completedAt: null, source: 'tasks' } as object,
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(tasks)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description, dueDate, isPriorityToday, columnId, logoUrl, source, assignee, isWaiting, meetingsCount, leadId } = await request.json()

  // Get max order inside column
  const lastTask = await prisma.task.findFirst({
    where: { columnId },
    orderBy: { order: 'desc' },
  })

  const newOrder = (lastTask?.order || 0) + 1000

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
      source: source || 'tasks',
      assignee: assignee || null,
      meetingsCount: meetingsCount || 0,
      leadId: leadId || null,
    } as any,
  })

  return NextResponse.json(task)
}
