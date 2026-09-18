import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  buildActionClientAnalysisDescription,
  buildActionClientDecisionDescription,
  buildActionClientPracticeDescription,
  parseActionClientTaskDescription,
} from '@/lib/action-clients'

const NEGOTIATIONS_SOURCE = 'negotiations'
const NEGOTIATION_STAGES = ['Não atribuídas', 'Em negociação', 'Ganho', 'Perdido']

const NEGOTIATION_STAGE_COLORS = ['#60a5fa', '#f59e0b', '#22c55e', '#ef4444']

const ACTIONS_SOURCE = 'acoes'
const ACTION_STAGES = ['Validando novas ações', 'Decidir', 'Em análise', 'Quais ações pôr em prática', 'Em prática']
const ACTION_STAGE_COLORS = ['#60a5fa', '#f59e0b', '#8b5cf6', '#14b8a6', '#22c55e']

function normalizeColumnTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

async function ensureBoard(source: string, stages: string[], colors: string[]) {
  const existingCount = await prisma.column.count({ where: { source } })
  if (existingCount > 0) return

  await prisma.column.createMany({
    data: stages.map((title, index) => ({
      title,
      color: colors[index],
      order: (index + 1) * 1000,
      source,
    })),
  })
}

async function advanceExpiredActionClients() {
  const columns = await prisma.column.findMany({
    where: { source: ACTIONS_SOURCE },
    include: { tasks: { orderBy: { order: 'asc' } } },
    orderBy: { order: 'asc' },
  })

  const validationColumn = columns.find((column) => normalizeColumnTitle(column.title) === 'validando novas acoes')
  const decideColumn = columns.find((column) => normalizeColumnTitle(column.title) === 'decidir')
  const analysisColumn = columns.find((column) => normalizeColumnTitle(column.title) === 'em analise')
  const practiceColumn = columns.find((column) => normalizeColumnTitle(column.title) === 'quais acoes por em pratica')

  const now = Date.now()
  const nowIso = new Date().toISOString()

  if (analysisColumn) {
    const tasksMissingAnalysisAt = analysisColumn.tasks.filter((task) => {
      const payload = parseActionClientTaskDescription(task.description)
      return payload && !payload.analysisAt
    })

    if (tasksMissingAnalysisAt.length > 0) {
      await prisma.$transaction(tasksMissingAnalysisAt.map((task) => (
        prisma.task.update({
          where: { id: task.id },
          data: {
            description: buildActionClientAnalysisDescription(task.description, nowIso),
          },
        })
      )))
    }
  }

  if (practiceColumn) {
    const tasksMissingPracticeAt = practiceColumn.tasks.filter((task) => {
      const payload = parseActionClientTaskDescription(task.description)
      return payload && !payload.practiceAt
    })

    if (tasksMissingPracticeAt.length > 0) {
      await prisma.$transaction(tasksMissingPracticeAt.map((task) => (
        prisma.task.update({
          where: { id: task.id },
          data: {
            description: buildActionClientPracticeDescription(task.description, nowIso),
          },
        })
      )))
    }
  }

  if (validationColumn && decideColumn) {
    const expiredTasks = validationColumn.tasks.filter((task) => {
      const payload = parseActionClientTaskDescription(task.description)
      if (!payload?.dueAt) return false
      const dueTime = new Date(payload.dueAt).getTime()
      return Number.isFinite(dueTime) && dueTime <= now
    })

    if (expiredTasks.length > 0) {
      const lastOrder = decideColumn.tasks.reduce((maxOrder, task) => Math.max(maxOrder, task.order), 0)
      await prisma.$transaction(expiredTasks.map((task, index) => (
        prisma.task.update({
          where: { id: task.id },
          data: {
            columnId: decideColumn.id,
            order: lastOrder + (index + 1) * 1000,
            description: buildActionClientDecisionDescription(task.description, nowIso),
          },
        })
      )))
    }
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source') || 'kanban'

  if (source === NEGOTIATIONS_SOURCE) await ensureBoard(NEGOTIATIONS_SOURCE, NEGOTIATION_STAGES, NEGOTIATION_STAGE_COLORS)
  if (source === ACTIONS_SOURCE) {
    await ensureBoard(ACTIONS_SOURCE, ACTION_STAGES, ACTION_STAGE_COLORS)
    await advanceExpiredActionClients()
  }

  const columns = await prisma.column.findMany({
    where: { source },
    include: {
      tasks: {
        where: { source },
        orderBy: { order: 'asc' },
        include: source === NEGOTIATIONS_SOURCE
          ? { negotiation: { select: { negotiatedAt: true, expectedCloseAt: true, totalValue: true } } }
          : undefined,
      },
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(columns)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, source, color } = await request.json()
  const columnSource = source || 'kanban'

  // Get max order for this source
  const lastColumn = await prisma.column.findFirst({
    where: { source: columnSource } as object,
    orderBy: { order: 'desc' },
  })

  const newOrder = (lastColumn?.order || 0) + 1000

  const column = await prisma.column.create({
    data: {
      title,
      color: color || null,
      order: newOrder,
      source: columnSource,
    },
  })

  return NextResponse.json(column)
}
