// src/app/api/agenda/events/series/route.ts
import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { validateEventRange, combineDateAndTime } from '@/lib/agenda-date'
import { normalizeDateToBrazilDay } from '@/lib/date-range'

const MAX_OCCURRENCES = 104 // ~2 anos de repetição semanal

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description, categoryId, leadId, startTime, endTime, seriesStartDate, weekdays, untilDate } =
    await request.json()

  if (!title || !startTime || !endTime || !seriesStartDate || !untilDate) {
    return NextResponse.json({ error: 'Título, horário, data inicial e data final são obrigatórios' }, { status: 400 })
  }
  if (!Array.isArray(weekdays) || weekdays.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos um dia da semana' }, { status: 400 })
  }

  const start = new Date(seriesStartDate)
  const until = new Date(untilDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(until.getTime())) {
    return NextResponse.json({ error: 'Data inicial ou final inválida' }, { status: 400 })
  }
  if (until < start) {
    return NextResponse.json({ error: 'A data final deve ser depois da data inicial' }, { status: 400 })
  }

  const weekdaySet = new Set<number>(weekdays)
  const occurrenceDates: Date[] = []
  // Trabalha em dias civis de Brasília (UTC fixo), não no fuso do runtime
  // do servidor — em produção (Vercel) o processo roda em UTC.
  const cursor = normalizeDateToBrazilDay(start)
  const untilDay = normalizeDateToBrazilDay(until)

  while (cursor <= untilDay) {
    if (weekdaySet.has(cursor.getUTCDay())) {
      occurrenceDates.push(new Date(cursor))
      if (occurrenceDates.length > MAX_OCCURRENCES) {
        return NextResponse.json(
          { error: `Período muito longo — o limite é ${MAX_OCCURRENCES} ocorrências por série. Reduza a data final ou os dias selecionados.` },
          { status: 400 }
        )
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  if (occurrenceDates.length === 0) {
    return NextResponse.json({ error: 'Nenhuma ocorrência cai nos dias selecionados dentro do período' }, { status: 400 })
  }

  const rows = occurrenceDates.map((date) => {
    const startsAt = combineDateAndTime(date, startTime)
    const endsAt = combineDateAndTime(date, endTime)
    return { startsAt, endsAt }
  })

  for (const row of rows) {
    const validationError = validateEventRange(row.startsAt, row.endsAt)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
  }

  const seriesId = randomUUID()

  try {
    const result = await prisma.agendaEvent.createMany({
      data: rows.map((row) => ({
        title,
        description: description || null,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        categoryId: categoryId || null,
        leadId: leadId || null,
        seriesId,
      })),
    })
    return NextResponse.json({ seriesId, count: result.count })
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === 'P2003') return NextResponse.json({ error: 'Categoria ou lead informado não existe' }, { status: 400 })
    throw error
  }
}
