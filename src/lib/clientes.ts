import type { Task } from '@/types'

/**
 * Palavras-chave que identificam uma coluna de encerramento/saída
 * nos quadros de Processos e Mentoria (ex: "Encerrado", "Cancelados").
 */
export const CHURN_COLUMN_KEYWORDS = ['encerrado', 'cancelado', 'inativo', 'churned']

export function isChurnColumnTitle(title: string): boolean {
  const normalized = title.toLowerCase()
  return CHURN_COLUMN_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

/** Um cliente é considerado "saído" quando churnedAt está preenchido. */
export function isClientChurned(task: Pick<Task, 'churnedAt'>): boolean {
  return Boolean(task.churnedAt)
}

export const CHURN_REASONS = [
  'Preço',
  'Insatisfação com o serviço',
  'Concorrência',
  'Sem orçamento / verba',
  'Mudança de estratégia interna',
  'Outro',
] as const

export type ChurnReason = (typeof CHURN_REASONS)[number]

export const DEFAULT_ENCERRADO_COLUMN_TITLE = 'Encerrado'
