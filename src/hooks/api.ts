'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Column, Task } from '@/types'

// ——— Columns ———
export function useColumns(source: string = 'kanban') {
  return useQuery<Column[]>({
    queryKey: ['columns', source],
    queryFn: async () => {
      const res = await fetch(`/api/columns?source=${source}`)
      if (!res.ok) throw new Error('Failed to fetch columns')
      return res.json()
    },
    staleTime: 30_000,
  })
}

export function useCreateColumn(source: string = 'kanban') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch('/api/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, source }),
      })
      if (!res.ok) throw new Error('Failed to create column')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns', source] }),
  })
}

export function useUpdateColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; order?: number }) => {
      const res = await fetch(`/api/columns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update column')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns'] }),
  })
}

export function useDeleteColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/columns/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete column')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns'] }),
  })
}

export function useReorderColumns() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: { id: string; order: number }[]) => {
      const res = await fetch('/api/columns/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error('Failed to reorder columns')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns'] }),
  })
}

// ——— Tasks ———
export function useAllTasks() {
  return useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await fetch('/api/tasks')
      if (!res.ok) throw new Error('Failed to fetch tasks')
      return res.json()
    },
    staleTime: 30_000,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      title: string
      description?: string
      dueDate?: string
      isPriorityToday?: boolean
      columnId: string
    }) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create task')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['columns'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: unknown }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update task')
      return res.json()
    },
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previousTasks = qc.getQueryData<Task[]>(['tasks'])
      qc.setQueryData<Task[]>(['tasks'], old =>
        old?.map(t => t.id === id ? { ...t, ...data } as Task : t) ?? []
      )
      return { previousTasks }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousTasks !== undefined) {
        qc.setQueryData(['tasks'], ctx.previousTasks)
      }
    },
    onSettled: (_data, _err, variables) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['columns'] })
      if ('completedAt' in variables) {
        qc.invalidateQueries({ queryKey: ['tasks-history'] })
      }
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete task')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['columns'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useCompletedTasks() {
  return useQuery<Task[]>({
    queryKey: ['tasks-history'],
    queryFn: async () => {
      const res = await fetch('/api/tasks/history')
      if (!res.ok) throw new Error('Failed to fetch history')
      return res.json()
    },
    staleTime: 60_000,
  })
}

export function useReorderTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: { id: string; columnId: string; order: number }[]) => {
      const res = await fetch('/api/tasks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error('Failed to reorder tasks')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns'] }),
  })
}
