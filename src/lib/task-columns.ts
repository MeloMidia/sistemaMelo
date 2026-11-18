// Colunas do quadro de Tarefas. Elas são fixas (vêm das flags isDoing e
// isPriorityToday da tarefa); só o nome mostrado no título é editável, e o
// nome salvo fica em TaskColumnLabel com a chave da coluna.
export const TASK_COLUMNS = {
  'col-queue': 'Fila de Tarefas',
  'col-doing': 'Tarefas - Gustavo',
  'col-priority': 'Tarefa do dia - Guilherme',
} as const

export type TaskColumnKey = keyof typeof TASK_COLUMNS

export const TASK_COLUMN_LABEL_MAX = 60

export function isTaskColumnKey(key: unknown): key is TaskColumnKey {
  return typeof key === 'string' && Object.hasOwn(TASK_COLUMNS, key)
}
