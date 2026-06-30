// src/app/api/agenda/events/series/[seriesId]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { validateEventRange, combineDateAndTime } from '@/lib/agenda-date'
import { normalizeDateToBrazilDay } from '@/lib/date-range'

// Edita esta e todas as ocorrências futuras da série (a partir de `fromDate`).
// O dia de cada ocorrência não muda — só horário e os demais campos.
export async function PUT(request: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId } = await params
  const { fromDate, title, description, categoryId, leadId, status, startTime, endTime } = await request.json()

  if (!fromDate) {
    return NextResponse.json({ error: 'fromDate é obrigatório' }, { status: 400 })
  }
  const from = new Date(fromDate)
  if (Number.isNaN(from.getTime())) {
    return NextResponse.json({ error: 'fromDate inválido' }, { status: 400 })
  }

  const events = await prisma.agendaEvent.findMany({
    where: { seriesId, startsAt: { gte: from } },
  })
  if (events.length === 0) {
    return NextResponse.json({ error: 'Nenhum evento encontrado a partir dessa data nesta série' }, { status: 404 })
  }

  const updates = events.map((event) => {
    const brazilDay = normalizeDateToBrazilDay(event.startsAt)
    return {
      id: event.id,
      startsAt: startTime ? combineDateAndTime(brazilDay, startTime) : event.startsAt,
      endsAt: endTime ? combineDateAndTime(brazilDay, endTime) : event.endsAt,
    }
  })

  for (const u of updates) {
    const validationError = validateEventRange(u.startsAt, u.endsAt)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
  }

  try {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.agendaEvent.update({
          where: { id: u.id },
          data: {
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description: description || null }),
            startsAt: u.startsAt,
            endsAt: u.endsAt,
            ...(categoryId !== undefined && { categoryId: categoryId || null }),
            ...(leadId !== undefined && { leadId: leadId || null }),
            ...(status !== undefined && { status }),
          },
        })
      )
    )
    return NextResponse.json({ success: true, count: updates.length })
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === 'P2003') return NextResponse.json({ error: 'Categoria ou lead informado não existe' }, { status: 400 })
    throw error
  }
}

// Exclui esta e todas as ocorrências futuras da série (a partir de ?from=).
export async function DELETE(request: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId } = await params
  const { searchParams } = new URL(request.url)
  const fromDate = searchParams.get('from')
  if (!fromDate) {
    return NextResponse.json({ error: 'Parâmetro from é obrigatório' }, { status: 400 })
  }
  const from = new Date(fromDate)
  if (Number.isNaN(from.getTime())) {
    return NextResponse.json({ error: 'Parâmetro from inválido' }, { status: 400 })
  }

  const result = await prisma.agendaEvent.deleteMany({
    where: { seriesId, startsAt: { gte: from } },
  })
  return NextResponse.json({ success: true, count: result.count })
}
