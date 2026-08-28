// src/app/api/crm/leads/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { messages: true, tasks: true } },
    },
  })

  if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  return NextResponse.json(lead)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const {
    name, stageId, assignedToId, value, temperature, notes, followUpColumn,
    cpf, email, city, state, neighborhood, postalCode, address, instagram, nickname,
  } = await request.json()

  const followUpChanged = followUpColumn !== undefined

  try {
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(stageId !== undefined && { stageId }),
        ...(assignedToId !== undefined && { assignedToId }),
        ...(value !== undefined && { value }),
        ...(temperature !== undefined && { temperature }),
        ...(notes !== undefined && { notes }),
        ...(cpf !== undefined && { cpf }),
        ...(email !== undefined && { email }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(neighborhood !== undefined && { neighborhood }),
        ...(postalCode !== undefined && { postalCode }),
        ...(address !== undefined && { address }),
        ...(instagram !== undefined && { instagram }),
        ...(nickname !== undefined && { nickname }),
        ...(followUpChanged && {
          followUpColumn,
          followUpMovedAt: new Date(),
        }),
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    })

    // Registra histórico de follow up quando a coluna muda
    if (followUpChanged) {
      await prisma.followUpLog.create({
        data: { leadId: id, column: followUpColumn ?? null },
      })
    }

    return NextResponse.json(lead)
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }
    if (code === 'P2003') {
      return NextResponse.json({ error: 'Etapa ou responsável informado não existe' }, { status: 400 })
    }
    throw error
  }
}
