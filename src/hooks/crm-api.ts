// src/hooks/crm-api.ts
'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { LeadStage, CrmTag, CrmUser, Message, WhatsappConnection } from '@/types/crm'

// ——— Stages (board) ———
export function useStages() {
  return useQuery<LeadStage[]>({
    queryKey: ['crm-stages'],
    queryFn: async () => {
      const res = await fetch('/api/crm/stages')
      if (!res.ok) throw new Error('Failed to fetch stages')
      return res.json()
    },
    staleTime: 10_000,
  })
}

export function useCreateStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await fetch('/api/crm/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create stage')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-stages'] }),
  })
}

export function useDeleteStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/stages/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete stage')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-stages'] }),
  })
}

// ——— Lead ———
export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      name?: string
      stageId?: string
      assignedToId?: string | null
      value?: number | null
    }) => {
      const res = await fetch(`/api/crm/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update lead')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-stages'] }),
  })
}

// ——— Messages ———
export function useLeadMessages(leadId: string | null) {
  return useQuery<Message[]>({
    queryKey: ['crm-messages', leadId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/leads/${leadId}/messages`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      return res.json()
    },
    enabled: !!leadId,
  })
}

export function useSendMessage(leadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/crm/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send message')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-messages', leadId] })
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
    },
  })
}

// ——— Tags ———
export function useCrmTags() {
  return useQuery<CrmTag[]>({
    queryKey: ['crm-tags'],
    queryFn: async () => {
      const res = await fetch('/api/crm/tags')
      if (!res.ok) throw new Error('Failed to fetch tags')
      return res.json()
    },
    staleTime: 30_000,
  })
}

export function useCreateCrmTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await fetch('/api/crm/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create tag')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-tags'] }),
  })
}

export function useAttachTag(leadId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tagId: string) => {
      const res = await fetch(`/api/crm/leads/${leadId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      })
      if (!res.ok) throw new Error('Failed to attach tag')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-stages'] }),
  })
}

export function useDetachTag(leadId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tagId: string) => {
      const res = await fetch(`/api/crm/leads/${leadId}/tags/${tagId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to detach tag')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-stages'] }),
  })
}

// ——— Users ———
export function useCrmUsers() {
  return useQuery<CrmUser[]>({
    queryKey: ['crm-users'],
    queryFn: async () => {
      const res = await fetch('/api/crm/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      return res.json()
    },
    staleTime: 60_000,
  })
}

// ——— WhatsApp connection ———
export function useConnection() {
  return useQuery<WhatsappConnection>({
    queryKey: ['crm-connection'],
    queryFn: async () => {
      const res = await fetch('/api/crm/connection')
      if (!res.ok) throw new Error('Failed to fetch connection status')
      return res.json()
    },
    refetchInterval: (query) => (query.state.data?.status === 'open' ? false : 5_000),
  })
}

export function useQrCode(enabled: boolean) {
  return useQuery<{ base64?: string }>({
    queryKey: ['crm-qrcode'],
    queryFn: async () => {
      const res = await fetch('/api/crm/connection/qrcode')
      if (!res.ok) throw new Error('Failed to fetch QR code')
      return res.json()
    },
    enabled,
    refetchInterval: enabled ? 20_000 : false,
  })
}

// ——— Realtime (SSE) ———
export function useCrmStream() {
  const qc = useQueryClient()

  useEffect(() => {
    const es = new EventSource('/api/crm/stream')

    es.onmessage = () => {
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['crm-messages'] })
      qc.invalidateQueries({ queryKey: ['crm-connection'] })
    }

    return () => es.close()
  }, [qc])
}
