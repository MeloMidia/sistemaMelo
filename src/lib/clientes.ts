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

/**
 * Cliente sem churnedAt mas sentado numa coluna de encerramento: uma saída
 * legada, de antes desse campo existir. Sem data real de quando saiu — por
 * isso não entra em nenhum recorte de "ativos", mas também não vira uma
 * "saída" fabricada com data inventada.
 */
export function isLegacyChurn(task: Pick<Task, 'churnedAt'>, columnTitle: string): boolean {
  return !task.churnedAt && isChurnColumnTitle(columnTitle)
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

/**
 * Datas de promoção (Task.promocaoAte) guardam só o dia (meia-noite UTC),
 * não um instante — comparar/formatar via new Date(...).toLocaleDateString()
 * usa o fuso de quem está rodando o código e pode voltar/adiantar um dia.
 * Por isso todo cálculo de "venceu"/"vence em N dias" trabalha em cima da
 * string "YYYY-MM-DD" (dia de calendário no fuso do Brasil), sem Date.
 */
export function todayBrazilDateString(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

/** Extrai "YYYY-MM-DD" de uma data/ISO string, sem conversão de fuso. */
export function toDateOnlyString(value: string | Date): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10)
}

/** Diferença em dias (inteiro) entre dois "YYYY-MM-DD". Positivo = `to` no futuro. */
export function daysBetweenDateStrings(fromStr: string, toStr: string): number {
  const from = new Date(`${fromStr}T00:00:00Z`)
  const to = new Date(`${toStr}T00:00:00Z`)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}
