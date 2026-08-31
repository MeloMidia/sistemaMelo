'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Column, Task } from '@/types'
import { useUpdateTask } from '@/hooks/api'
import { isChurnColumnTitle } from '@/lib/clientes'

export interface PendingChurn {
  taskId: string
  taskTitle: string
  toColumnId: string
}

/**
 * Detecta quando um cliente é arrastado para uma coluna de encerramento
 * (ex: "Encerrado") e intercepta o movimento para pedir o motivo da saída
 * antes de confirmar. Também limpa a marcação de saída automaticamente
 * quando um cliente encerrado volta para uma coluna ativa (reativação).
 */
export function useChurnDragHandler(source: string) {
  const qc = useQueryClient()
  const updateTask = useUpdateTask()
  const [pendingChurn, setPendingChurn] = useState<PendingChurn | null>(null)

  /**
   * Chame no início do handleDragEnd, passando a task capturada no
   * handleDragStart (antes de qualquer reposicionamento otimista) e o id
   * ativo. Retorna true se o movimento foi interceptado — nesse caso o
   * chamador deve pular o commit normal do reorder até o modal resolver.
   */
  const interceptDragEnd = useCallback((draggedFrom: Task | null, activeId: string): boolean => {
    if (!draggedFrom) return false
    const currentColumns = qc.getQueryData<Column[]>(['columns', source])
    if (!currentColumns) return false

    let newColumnId: string | null = null
    let newColumnTitle = ''
    for (const col of currentColumns) {
      if (col.tasks.some((t) => t.id === activeId)) {
        newColumnId = col.id
        newColumnTitle = col.title
        break
      }
    }
    if (!newColumnId || newColumnId === draggedFrom.columnId) return false

    const enteringChurnColumn = isChurnColumnTitle(newColumnTitle)

    if (enteringChurnColumn && !draggedFrom.churnedAt) {
      setPendingChurn({ taskId: activeId, taskTitle: draggedFrom.title ?? '', toColumnId: newColumnId })
      return true
    }

    if (draggedFrom.churnedAt && !enteringChurnColumn) {
      // Reativação: cliente encerrado voltou para uma coluna ativa.
      updateTask.mutate({ id: activeId, churnedAt: null, churnReason: null, churnedBy: null })
    }

    return false
  }, [qc, source, updateTask])

  const confirmChurn = useCallback((reason: string) => {
    if (!pendingChurn) return
    updateTask.mutate({
      id: pendingChurn.taskId,
      columnId: pendingChurn.toColumnId,
      churnedAt: new Date().toISOString(),
      churnReason: reason,
    })
    setPendingChurn(null)
  }, [pendingChurn, updateTask])

  const cancelChurn = useCallback(() => {
    setPendingChurn(null)
    // Nada foi persistido no servidor — descarta o reposicionamento otimista.
    qc.invalidateQueries({ queryKey: ['columns', source] })
  }, [qc, source])

  return { pendingChurn, interceptDragEnd, confirmChurn, cancelChurn, isSaving: updateTask.isPending }
}
