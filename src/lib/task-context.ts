import { prisma } from '@/lib/prisma'

export const taskLeadInclude = {
  lead: {
    select: {
      id: true,
      name: true,
      phone: true,
      profilePicUrl: true,
      temperature: true,
      city: true,
      state: true,
      companyName: true,
      notes: true,
      stage: {
        select: {
          id: true,
          name: true,
        },
      },
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      },
    },
  },
} as const

const kanbanTaskContextSelect = {
  id: true,
  title: true,
  source: true,
  description: true,
  dueDate: true,
  logoUrl: true,
  notes: true,
  meetingsCount: true,
  adsAtivo: true,
  promocaoAtiva: true,
  promocaoAte: true,
  createdAt: true,
  column: {
    select: {
      id: true,
      title: true,
      source: true,
    },
  },
  tags: {
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  },
} as const

type TaskWithOptionalKanbanParent = {
  kanbanTaskId: string | null
}

export async function attachTaskContext<T extends TaskWithOptionalKanbanParent>(tasks: T[]) {
  const kanbanTaskIds = Array.from(
    new Set(
      tasks
        .map((task) => task.kanbanTaskId)
        .filter((id): id is string => Boolean(id))
    )
  )

  if (kanbanTaskIds.length === 0) {
    return tasks.map((task) => ({ ...task, kanbanTask: null }))
  }

  const kanbanTasks = await prisma.task.findMany({
    where: { id: { in: kanbanTaskIds } },
    select: kanbanTaskContextSelect,
  })

  const kanbanTaskById = new Map(kanbanTasks.map((task) => [task.id, task]))

  return tasks.map((task) => ({
    ...task,
    kanbanTask: task.kanbanTaskId ? kanbanTaskById.get(task.kanbanTaskId) ?? null : null,
  }))
}

function normalizeColumnTitle(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

export function isNegotiationRelatedTask(task: {
  lead?: {
    stage?: {
      name: string
    } | null
  } | null
  kanbanTask?: {
    source?: string
    column?: {
      source: string
      title: string
    } | null
  } | null
}) {
  const column = task.kanbanTask?.column
  const isProcessNegotiationColumn = column?.source === 'kanban' && normalizeColumnTitle(column.title) === 'em negociacao'
  const isNegotiationsBoardTask = task.kanbanTask?.source === 'negotiations' || column?.source === 'negotiations'
  const isCrmNegotiationLead = normalizeColumnTitle(task.lead?.stage?.name) === 'em negociacao'

  return isProcessNegotiationColumn || isNegotiationsBoardTask || isCrmNegotiationLead
}
