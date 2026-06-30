'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AgendaEvent, AgendaEventStatus, EventCategory } from '@/types/agenda'

// ——— Events ———
export function useAgendaEvents(start: Date, end: Date) {
  const startIso = start.toISOString()
  const endIso = end.toISOString()
  return useQuery<AgendaEvent[]>({
    queryKey: ['agenda-events', startIso, endIso],
    queryFn: async () => {
      const res = await fetch(`/api/agenda/events?start=${startIso}&end=${endIso}`)
      if (!res.ok) throw new Error('Failed to fetch events')
      return res.json()
    },
  })
}

export function useCreateAgendaEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { title: string; description?: string | null; startsAt: string; endsAt: string; categoryId?: string | null; leadId?: string | null }) => {
      const res = await fetch('/api/agenda/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to create event')
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-events'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateAgendaEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      title?: string
      description?: string | null
      startsAt?: string
      endsAt?: string
      categoryId?: string | null
      leadId?: string | null
      status?: AgendaEventStatus
    }) => {
      const res = await fetch(`/api/agenda/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to update event')
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-events'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteAgendaEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/agenda/events/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete event')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-events'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ——— Séries recorrentes ———
export function useCreateAgendaEventSeries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      title: string
      description?: string | null
      categoryId?: string | null
      leadId?: string | null
      startTime: string
      endTime: string
      seriesStartDate: string
      weekdays: number[]
      untilDate: string
    }) => {
      const res = await fetch('/api/agenda/events/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to create event series')
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-events'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateAgendaEventSeries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      seriesId,
      ...data
    }: {
      seriesId: string
      fromDate: string
      title?: string
      description?: string | null
      categoryId?: string | null
      leadId?: string | null
      status?: AgendaEventStatus
      startTime?: string
      endTime?: string
    }) => {
      const res = await fetch(`/api/agenda/events/series/${seriesId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to update event series')
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-events'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteAgendaEventSeries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ seriesId, fromDate }: { seriesId: string; fromDate: string }) => {
      const res = await fetch(`/api/agenda/events/series/${seriesId}?from=${encodeURIComponent(fromDate)}`, {
        method: 'DELETE',
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to delete event series')
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-events'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ——— Categories ———
export function useEventCategories() {
  return useQuery<EventCategory[]>({
    queryKey: ['agenda-categories'],
    queryFn: async () => {
      const res = await fetch('/api/agenda/categories')
      if (!res.ok) throw new Error('Failed to fetch categories')
      return res.json()
    },
    staleTime: 30_000,
  })
}

export function useCreateEventCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await fetch('/api/agenda/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create category')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda-categories'] }),
  })
}

export function useUpdateEventCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; color?: string }) => {
      const res = await fetch(`/api/agenda/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update category')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-categories'] })
      qc.invalidateQueries({ queryKey: ['agenda-events'] })
    },
  })
}

export function useDeleteEventCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/agenda/categories/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete category')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-categories'] })
      qc.invalidateQueries({ queryKey: ['agenda-events'] })
    },
  })
}
