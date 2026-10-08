/**
 * Tarefas concluídas ficam no histórico por TASK_HISTORY_DAYS dias; depois
 * disso o cron /api/cron/cleanup-tasks exclui de vez. Mesmo corte nos dois
 * lugares pra o histórico nunca prometer algo que a limpeza já apagou.
 */
export const TASK_HISTORY_DAYS = 30

export function taskHistoryCutoff(now = new Date()): Date {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - TASK_HISTORY_DAYS)
  return cutoff
}
