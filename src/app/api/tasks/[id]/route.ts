import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
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

  const task = await prisma.task.update({
    where: { id },
    data,
  })

  return NextResponse.json(task)
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
