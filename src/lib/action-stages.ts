import type { Column } from '@/types'

export const ACTION_STAGES = ['validation', 'decision', 'analysis', 'practice', 'execution'] as const
export type ActionStage = typeof ACTION_STAGES[number]

const ACTION_STAGE_ALIASES: Record<ActionStage, readonly string[]> = {
  validation: ['validando novas acoes'],
  decision: ['decidir', 'definir novas acoes', 'definindo novas acoes'],
  analysis: ['em analise'],
  practice: ['quais acoes por em pratica', 'acoes'],
  execution: ['em pratica'],
}

export function normalizeActionColumnTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

export function getActionStageFromTitle(title: string): ActionStage | null {
  const normalizedTitle = normalizeActionColumnTitle(title)

  for (const stage of ACTION_STAGES) {
    if (ACTION_STAGE_ALIASES[stage].includes(normalizedTitle)) return stage
  }

  return null
}

export function getActionStage(
  column: Pick<Column, 'title'>,
  columns?: ReadonlyArray<Pick<Column, 'title'>>
): ActionStage | null {
  const stageFromTitle = getActionStageFromTitle(column.title)
  if (stageFromTitle) return stageFromTitle

  const columnIndex = columns?.findIndex((candidate) => candidate.title === column.title) ?? -1
  return ACTION_STAGES[columnIndex] ?? null
}
