import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { attachTaskContext, taskLeadInclude } from '@/lib/task-context'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const existingTask = await prisma.task.findUnique({
    where: { id },
    select: { source: true, negotiation: { select: { service: true } } },
  })

  if (!existingTask) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description
  const dueDateChanged = body.dueDate !== undefined
  if (dueDateChanged) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
  if (body.isPriorityToday !== undefined) data.isPriorityToday = body.isPriorityToday
  if (body.isDoing !== undefined) data.isDoing = body.isDoing
  if (body.isWaiting !== undefined) data.isWaiting = body.isWaiting
  if (body.columnId !== undefined) data.columnId = body.columnId
  if (body.order !== undefined) data.order = body.order
  if (body.completedAt !== undefined) data.completedAt = body.completedAt ? new Date(body.completedAt) : null
  if (body.completedBy !== undefined) data.completedBy = body.completedBy
  if (body.churnedAt !== undefined) data.churnedAt = body.churnedAt ? new Date(body.churnedAt) : null
  if (body.churnReason !== undefined) data.churnReason = body.churnReason
  if (body.churnedBy !== undefined) data.churnedBy = body.churnedBy
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl
  if (body.assignee !== undefined) data.assignee = body.assignee
  if (body.notes !== undefined) data.notes = body.notes
  if (body.meetingsCount !== undefined) data.meetingsCount = body.meetingsCount
  if (body.adsAtivo !== undefined) data.adsAtivo = body.adsAtivo
  if (body.promocaoAtiva !== undefined) data.promocaoAtiva = body.promocaoAtiva
  if (body.promocaoAte !== undefined) data.promocaoAte = body.promocaoAte ? new Date(body.promocaoAte) : null

  const negotiationValueChanged = body.negotiationTotalValue !== undefined
  const nextNegotiationValue = Number(body.negotiationTotalValue)
  if (negotiationValueChanged && existingTask.source === 'negotiations') {
    if (!Number.isFinite(nextNegotiationValue) || nextNegotiationValue < 0) {
      return NextResponse.json({ error: 'O valor da negociação é inválido.' }, { status: 400 })
    }

    if (body.description === undefined && existingTask.negotiation?.service) {
      data.description = `${existingTask.negotiation.service} \u00b7 ${nextNegotiationValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
    }
  }

  const task = await prisma.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
      where: { id },
      data,
      include: taskLeadInclude,
    })

    if (negotiationValueChanged && existingTask.source === 'negotiations') {
      await tx.negotiation.update({
        where: { taskId: id },
        data: { totalValue: nextNegotiationValue },
      })
    }

    return updatedTask
  })

  if (dueDateChanged && task.source === 'negotiations') {
    await prisma.negotiation.update({
      where: { taskId: id },
      data: { expectedCloseAt: task.dueDate },
    }).catch(() => null)
  }

  const [taskWithContext] = await attachTaskContext([task])
  return NextResponse.json(taskWithContext)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await prisma.task.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
