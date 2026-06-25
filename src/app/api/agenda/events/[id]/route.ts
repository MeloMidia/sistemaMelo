// src/app/api/agenda/events/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

function validateRange(startsAt: Date, endsAt: Date): string | null {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return 'Data ou horário inválido'
  }
  if (endsAt <= startsAt) {
    return 'O horário de fim deve ser depois do início'
  }
  if (startsAt.toDateString() !== endsAt.toDateString()) {
    return 'O evento deve começar e terminar no mesmo dia'
  }
  return null
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { title, startsAt, endsAt, categoryId } = await request.json()

  const existing = await prisma.agendaEvent.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

  const start = startsAt ? new Date(startsAt) : existing.startsAt
  const end = endsAt ? new Date(endsAt) : existing.endsAt
  const validationError = validateRange(start, end)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  try {
    const event = await prisma.agendaEvent.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        startsAt: start,
        endsAt: end,
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
      },
      include: { category: true },
    })
    return NextResponse.json(event)
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === 'P2003') return NextResponse.json({ error: 'Categoria informada não existe' }, { status: 400 })
    throw error
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    await prisma.agendaEvent.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    // já apagada — idempotente, mesmo padrão de detach de tags
    if (code === 'P2025') return NextResponse.json({ success: true })
    throw error
  }
}
