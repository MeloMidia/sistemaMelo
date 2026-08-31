import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getLeadDisplayName } from '@/lib/phone'

function asNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const negotiations = await prisma.negotiation.findMany({
    where: { leadId: id },
    include: {
      responsible: { select: { id: true, name: true } },
      task: { select: { id: true, columnId: true, title: true, dueDate: true } },
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
    },
    orderBy: { negotiatedAt: 'desc' },
  })

  return NextResponse.json(negotiations)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: leadId } = await params
  const body = await request.json()
  const stageId = typeof body.stageId === 'string' ? body.stageId : ''
  const service = typeof body.service === 'string' ? body.service.trim() : ''
  const negotiatedAt = body.negotiatedAt ? new Date(body.negotiatedAt) : null
  const quantity = Math.max(1, Math.floor(asNumber(body.quantity)))
  const unitPrice = Math.max(0, asNumber(body.unitPrice))
  const discount = Math.max(0, asNumber(body.discount))
  const rawTagIds: unknown[] = Array.isArray(body.tagIds) ? body.tagIds : []
  const tagIds = rawTagIds.filter((tagId): tagId is string => typeof tagId === 'string')

  if (!stageId || !service || !negotiatedAt || Number.isNaN(negotiatedAt.getTime())) {
    return NextResponse.json({ error: 'Preencha o estágio, a data e o serviço negociado.' }, { status: 400 })
  }

  const [lead, stage, responsible] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, name: true, phone: true, profilePicUrl: true } }),
    prisma.column.findFirst({ where: { id: stageId, source: 'negotiations' } }),
    body.responsibleId ? prisma.user.findUnique({ where: { id: body.responsibleId }, select: { id: true, name: true } }) : null,
  ])

  if (!lead) return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 })
  if (!stage) return NextResponse.json({ error: 'Estágio de negociação inválido.' }, { status: 400 })
  if (body.responsibleId && !responsible) return NextResponse.json({ error: 'Responsável não encontrado.' }, { status: 400 })

  const totalValue = Math.max(0, quantity * unitPrice - discount)
  const description = `${service} · ${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
  const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

  const negotiation = await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        title: getLeadDisplayName(lead),
        description,
        dueDate: negotiatedAt,
        columnId: stage.id,
        order: (await tx.task.count({ where: { columnId: stage.id } }) + 1) * 1000,
        source: 'negotiations',
        assignee: responsible?.name ?? null,
        logoUrl: lead.profilePicUrl ?? undefined,
        leadId,
      },
    })

    return tx.negotiation.create({
      data: {
        leadId,
        taskId: task.id,
        responsibleId: responsible?.id ?? null,
        negotiatedAt,
        service,
        quantity,
        unitPrice,
        discount,
        totalValue,
        notes,
        tags: tagIds.length ? { create: tagIds.map((tagId: string) => ({ tagId })) } : undefined,
      },
      include: {
        responsible: { select: { id: true, name: true } },
        task: { select: { id: true, columnId: true, title: true, dueDate: true } },
        tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    })
  })

  return NextResponse.json(negotiation, { status: 201 })
}
