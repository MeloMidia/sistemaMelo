import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  buildActionClientAnalysisDescription,
  buildActionClientDecisionDescription,
  buildActionClientExecutionDescription,
  buildActionClientPracticeDescription,
  parseActionClientTaskDescription,
} from '@/lib/action-clients'

function normalizeColumnTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { items } = await request.json()
  if (!items?.length) return NextResponse.json({ success: true })

  const rows = (items as { id: string; columnId: string; order: number }[]).map(i =>
    Prisma.sql`(${i.id}::text, ${i.columnId}::text, ${i.order}::int4)`
  )

  await prisma.$executeRaw`
    UPDATE "Task" AS t
    SET "columnId" = v.column_id, "order" = v.ord
    FROM (VALUES ${Prisma.join(rows)}) AS v(id, column_id, ord)
    WHERE t.id = v.id
  `

  const typedItems = items as { id: string; columnId: string }[]
  const targetColumnIds = [...new Set(typedItems.map((item) => item.columnId))]
  const actionColumns = await prisma.column.findMany({
    where: { id: { in: targetColumnIds }, source: 'acoes' },
    select: { id: true, title: true },
  })
  const trackedColumns = new Map<string, 'decidir' | 'em-analise' | 'pratica' | 'em-pratica'>()
  actionColumns.forEach((column) => {
    const normalizedTitle = normalizeColumnTitle(column.title)
    if (normalizedTitle === 'decidir') trackedColumns.set(column.id, 'decidir')
    if (normalizedTitle === 'em analise') trackedColumns.set(column.id, 'em-analise')
    if (normalizedTitle === 'quais acoes por em pratica') trackedColumns.set(column.id, 'pratica')
    if (normalizedTitle === 'em pratica') trackedColumns.set(column.id, 'em-pratica')
  })

  if (trackedColumns.size > 0) {
    const trackedTaskItems = typedItems.filter((item) => trackedColumns.has(item.columnId))

    if (trackedTaskItems.length > 0) {
      const enteredAt = new Date().toISOString()
      const taskStage = new Map(trackedTaskItems.map((item) => [item.id, trackedColumns.get(item.columnId)]))
      const actionTasks = await prisma.task.findMany({
        where: { id: { in: trackedTaskItems.map((item) => item.id) }, source: 'acoes' },
        select: { id: true, description: true },
      })
      const updates = actionTasks
        .filter((task) => {
          const payload = parseActionClientTaskDescription(task.description)
          const stage = taskStage.get(task.id)
          if (!payload || !stage) return false
          if (stage === 'decidir') return !payload.decidedAt
          if (stage === 'em-analise') return !payload.analysisAt
          if (stage === 'pratica') return !payload.practiceAt
          return !payload.executionAt
        })
        .map((task) => prisma.task.update({
          where: { id: task.id },
          data: {
            description: (() => {
              const stage = taskStage.get(task.id)
              if (stage === 'decidir') return buildActionClientDecisionDescription(task.description, enteredAt)
              if (stage === 'em-analise') return buildActionClientAnalysisDescription(task.description, enteredAt)
              if (stage === 'pratica') return buildActionClientPracticeDescription(task.description, enteredAt)
              return buildActionClientExecutionDescription(task.description, enteredAt)
            })(),
          },
        }))

      if (updates.length > 0) await prisma.$transaction(updates)
    }
  }

  return NextResponse.json({ success: true })
}
