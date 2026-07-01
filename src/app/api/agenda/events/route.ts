// src/app/api/agenda/events/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { validateEventRange } from '@/lib/agenda-date'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) {
    return NextResponse.json({ error: 'Parâmetros start e end são obrigatórios' }, { status: 400 })
  }

  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'Parâmetros start e end inválidos' }, { status: 400 })
  }

  const events = await prisma.agendaEvent.findMany({
    where: {
      startsAt: { lte: endDate },
      endsAt: { gte: startDate },
    },
    include: {
      category: true,
      lead: {
        select: {
          id: true,
          temperature: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: { startsAt: 'asc' },
  })
  return NextResponse.json(events)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description, startsAt, endsAt, categoryId, leadId } = await request.json()
  if (!title || !startsAt || !endsAt) {
    return NextResponse.json({ error: 'Título, início e fim são obrigatórios' }, { status: 400 })
  }

  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const validationError = validateEventRange(start, end)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  try {
    const event = await prisma.agendaEvent.create({
      data: {
        title,
        description: description || null,
        startsAt: start,
        endsAt: end,
        categoryId: categoryId || null,
        leadId: leadId || null,
      },
      include: {
        category: true,
        lead: {
          select: {
            id: true,
            temperature: true,
            name: true,
            phone: true,
          },
        },
      },
    })
    return NextResponse.json(event)
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === 'P2003') return NextResponse.json({ error: 'Categoria informada não existe' }, { status: 400 })
    throw error
  }
}
