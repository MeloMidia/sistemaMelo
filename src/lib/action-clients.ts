import type { Task } from '@/types'

const ACTION_CLIENTS_PREFIX = 'ACTION_CLIENTS_V1:'
const ACTION_CLIENT_TASK_PREFIX = 'ACTION_CLIENT_TASK_V1:'
export const ACTION_CLIENT_VALIDATION_DAYS = 4

export interface ActionClientPracticeAction {
  text: string
  completedAt?: string
}

export interface ActionClientCompletionRecord {
  completedAt: string
  actions: string[]
}

export type ActionClientSnapshot = Pick<Task, 'id' | 'title' | 'logoUrl'>
export interface ActionClientTaskPayload {
  actionTitle: string
  clientId: string
  clientTitle: string
  createdAt: string
  dueAt: string
  decidedAt?: string
  analysisAt?: string
  practiceAt?: string
  executionAt?: string
  practiceActions?: ActionClientPracticeAction[]
  completionHistory?: ActionClientCompletionRecord[]
}

type ActionClientStageTimestamp = 'decidedAt' | 'analysisAt' | 'practiceAt' | 'executionAt'

export function buildActionClientsDescription(clients: ActionClientSnapshot[]) {
  return `${ACTION_CLIENTS_PREFIX}${JSON.stringify(clients.map((client) => ({
    id: client.id,
    title: client.title,
    logoUrl: client.logoUrl,
  })))}`
}

export function parseActionClientsDescription(description: string | null | undefined): ActionClientSnapshot[] {
  if (!description?.startsWith(ACTION_CLIENTS_PREFIX)) return []

  try {
    const parsed = JSON.parse(description.slice(ACTION_CLIENTS_PREFIX.length))
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((client): client is ActionClientSnapshot => (
        typeof client?.id === 'string'
        && typeof client?.title === 'string'
        && (typeof client?.logoUrl === 'string' || client?.logoUrl === null)
      ))
  } catch {
    return []
  }
}

export function buildActionClientTaskDescription(payload: ActionClientTaskPayload) {
  return `${ACTION_CLIENT_TASK_PREFIX}${JSON.stringify(payload)}`
}

export function parseActionClientTaskDescription(description: string | null | undefined): ActionClientTaskPayload | null {
  if (!description?.startsWith(ACTION_CLIENT_TASK_PREFIX)) return null

  try {
    const payload = JSON.parse(description.slice(ACTION_CLIENT_TASK_PREFIX.length))
    if (
      typeof payload?.actionTitle !== 'string'
      || typeof payload?.clientId !== 'string'
      || typeof payload?.clientTitle !== 'string'
      || typeof payload?.createdAt !== 'string'
      || typeof payload?.dueAt !== 'string'
      || (payload?.decidedAt !== undefined && typeof payload.decidedAt !== 'string')
      || (payload?.analysisAt !== undefined && typeof payload.analysisAt !== 'string')
      || (payload?.practiceAt !== undefined && typeof payload.practiceAt !== 'string')
      || (payload?.executionAt !== undefined && typeof payload.executionAt !== 'string')
      || (payload?.practiceActions !== undefined && (
        !Array.isArray(payload.practiceActions)
        || payload.practiceActions.some((action: unknown) => (
          typeof action === 'string'
            ? false
            : typeof action !== 'object'
              || action === null
              || typeof (action as { text?: unknown }).text !== 'string'
              || ((action as { completedAt?: unknown }).completedAt !== undefined
                && typeof (action as { completedAt?: unknown }).completedAt !== 'string')
        ))
      ))
      || (payload?.completionHistory !== undefined && (
        !Array.isArray(payload.completionHistory)
        || payload.completionHistory.some((record: unknown) => (
          typeof record !== 'object'
            || record === null
            || typeof (record as { completedAt?: unknown }).completedAt !== 'string'
            || !Array.isArray((record as { actions?: unknown }).actions)
            || (record as { actions: unknown[] }).actions.some((action) => typeof action !== 'string')
        ))
      ))
    ) {
      return null
    }

    return {
      ...payload,
      practiceActions: normalizePracticeChecklist(payload.practiceActions),
      completionHistory: payload.completionHistory ?? [],
    }
  } catch {
    return null
  }
}

export function buildActionClientDueDate(from: Date = new Date()) {
  return new Date(from.getTime() + ACTION_CLIENT_VALIDATION_DAYS * 86_400_000).toISOString()
}

export function getActionClientDaysRemaining(dueAt: string | null | undefined) {
  if (!dueAt) return null
  const dueTime = new Date(dueAt).getTime()
  if (!Number.isFinite(dueTime)) return null
  return Math.max(0, Math.ceil((dueTime - Date.now()) / 86_400_000))
}

export function buildActionClientDecisionDescription(description: string | null | undefined, decidedAt: string) {
  return buildActionClientStageDescription(description, 'decidedAt', decidedAt)
}

export function buildActionClientAnalysisDescription(description: string | null | undefined, analysisAt: string) {
  return buildActionClientStageDescription(description, 'analysisAt', analysisAt)
}

export function buildActionClientPracticeDescription(description: string | null | undefined, practiceAt: string) {
  return buildActionClientStageDescription(description, 'practiceAt', practiceAt)
}

export function buildActionClientExecutionDescription(description: string | null | undefined, executionAt: string) {
  return buildActionClientStageDescription(description, 'executionAt', executionAt)
}

export function buildActionClientStageDescription(
  description: string | null | undefined,
  stageTimestamp: ActionClientStageTimestamp,
  enteredAt: string
) {
  const payload = parseActionClientTaskDescription(description)
  if (!payload) return description ?? null
  return buildActionClientTaskDescription({
    ...payload,
    [stageTimestamp]: payload[stageTimestamp] ?? enteredAt,
  })
}

export function getActionClientDecisionDays(decidedAt: string | null | undefined) {
  if (!decidedAt) return null
  const decidedTime = new Date(decidedAt).getTime()
  if (!Number.isFinite(decidedTime)) return null
  return Math.max(1, Math.floor((Date.now() - decidedTime) / 86_400_000) + 1)
}

export function getActionClientStageDaysElapsed(startedAt: string | null | undefined) {
  return getActionClientDecisionDays(startedAt)
}

export function normalizePracticeChecklist(actions: Array<string | ActionClientPracticeAction> | null | undefined) {
  return [0, 1, 2].map((index) => {
    const action = actions?.[index]
    if (typeof action === 'string') return { text: action }
    return {
      text: action?.text ?? '',
      ...(action?.completedAt ? { completedAt: action.completedAt } : {}),
    }
  })
}

export function normalizePracticeActions(actions: Array<string | ActionClientPracticeAction> | null | undefined) {
  return normalizePracticeChecklist(actions).map((action) => action.text)
}

export function buildActionClientPracticeActionsDescription(description: string | null | undefined, actions: string[]) {
  const payload = parseActionClientTaskDescription(description)
  if (!payload) return description ?? null
  return buildActionClientTaskDescription({
    ...payload,
    practiceActions: normalizePracticeChecklist(actions),
  })
}

export function buildActionClientPracticeChecklistDescription(
  description: string | null | undefined,
  checklist: ActionClientPracticeAction[]
) {
  const payload = parseActionClientTaskDescription(description)
  if (!payload) return description ?? null
  return buildActionClientTaskDescription({
    ...payload,
    practiceActions: normalizePracticeChecklist(checklist),
  })
}

export function buildActionClientCompletionDescription(
  description: string | null | undefined,
  completedAt: string
) {
  const payload = parseActionClientTaskDescription(description)
  if (!payload) return description ?? null

  const checklist = normalizePracticeChecklist(payload.practiceActions)
  const completedActions = checklist
    .map((action) => action.text.trim())
    .filter(Boolean)

  return buildActionClientTaskDescription({
    actionTitle: payload.actionTitle,
    clientId: payload.clientId,
    clientTitle: payload.clientTitle,
    createdAt: payload.createdAt,
    dueAt: buildActionClientDueDate(new Date(completedAt)),
    practiceActions: checklist.map((action) => ({ text: action.text })),
    completionHistory: [
      ...(payload.completionHistory ?? []),
      { completedAt, actions: completedActions },
    ],
  })
}
