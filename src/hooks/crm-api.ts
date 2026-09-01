// src/hooks/crm-api.ts
'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { LeadStage, LeadLite, Lead, CrmTag, CrmUser, Message, WhatsappConnection, LabelColumn, FollowUpColumnData } from '@/types/crm'

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
    refetchInterval: 20_000,
  })
}

// Lista leve de leads (sem tags/mensagens/etc.) para seletores como o de
// "Lead vinculado" no modal de eventos — evita buscar o board pesado do CRM.
export function useLeadsLite() {
  return useQuery<LeadLite[]>({
    queryKey: ['crm-leads-lite'],
    queryFn: async () => {
      const res = await fetch('/api/crm/leads')
      if (!res.ok) throw new Error('Failed to fetch leads')
      return res.json()
    },
    staleTime: 30_000,
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; phone: string; stageId?: string }) => {
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Não foi possível criar o lead.')
      return result as Lead
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['crm-conversations'] })
      qc.invalidateQueries({ queryKey: ['crm-leads-lite'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const res = await fetch(`/api/crm/stages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      })
      if (!res.ok) throw new Error('Failed to update stage')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useReorderStages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (stages: Array<{ id: string; order: number }>) => {
      const res = await fetch('/api/crm/stages/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages }),
      })
      if (!res.ok) throw new Error('Failed to reorder stages')
      return res.json()
    },
    onError: () => qc.invalidateQueries({ queryKey: ['crm-stages'] }),
  })
}

export function useMoveAllLeads() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fromStageId, toStageId }: { fromStageId: string; toStageId: string }) => {
      const res = await fetch(`/api/crm/stages/${fromStageId}/move-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStageId }),
      })
      if (!res.ok) throw new Error('Failed to move leads')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useMoveAllFollowUpLeads() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fromColumn, toColumn }: { fromColumn: number; toColumn: number }) => {
      const res = await fetch('/api/crm/follow-up/move-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromColumn, toColumn }),
      })
      if (!res.ok) throw new Error('Failed to move leads')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-follow-up'] }),
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
      name?: string | null
      stageId?: string | null
      assignedToId?: string | null
      value?: number | null
      temperature?: string | null
      notes?: string | null
      cpf?: string | null
      email?: string | null
      city?: string | null
      state?: string | null
      neighborhood?: string | null
      postalCode?: string | null
      address?: string | null
      instagram?: string | null
      nickname?: string | null
    }) => {
      const res = await fetch(`/api/crm/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update lead')
      return res.json()
    },
    onMutate: async (newLeadData) => {
      await qc.cancelQueries({ queryKey: ['crm-stages'] })
      const previousStages = qc.getQueryData<LeadStage[]>(['crm-stages'])

      if (previousStages) {
        qc.setQueryData<LeadStage[]>(
          ['crm-stages'],
          previousStages.map((stage) => {
            const isTargetStage = newLeadData.stageId && stage.id === newLeadData.stageId
            const hasLead = stage.leads.some((lead) => lead.id === newLeadData.id)

            if (hasLead) {
              if (newLeadData.stageId && newLeadData.stageId !== stage.id) {
                return {
                  ...stage,
                  leads: stage.leads.filter((lead) => lead.id !== newLeadData.id),
                }
              }
              return {
                ...stage,
                leads: stage.leads.map((lead) => {
                  if (lead.id === newLeadData.id) {
                    return { ...lead, ...newLeadData }
                  }
                  return lead
                }),
              }
            } else if (isTargetStage) {
              let leadData = null
              for (const s of previousStages) {
                const l = s.leads.find((lead) => lead.id === newLeadData.id)
                if (l) {
                  leadData = l
                  break
                }
              }
              if (leadData) {
                return {
                  ...stage,
                  leads: [...stage.leads, { ...leadData, ...newLeadData }],
                }
              }
            }
            return stage
          })
        )
      }

      return { previousStages }
    },
    onError: (err, newLeadData, context) => {
      if (context?.previousStages) {
        qc.setQueryData(['crm-stages'], context.previousStages)
      }
    },
    onSuccess: (updatedLead: { id: string }) => {
      // Substitui o merge otimista (parcial) pela resposta confirmada do
      // servidor — corrige campos como updatedAt/assignedTo sem precisar
      // invalidar e re-buscar o board inteiro (caro, ver fix de performance
      // do termômetro).
      qc.setQueryData<LeadStage[]>(['crm-stages'], (old) => {
        if (!old) return old
        return old.map((stage) => ({
          ...stage,
          leads: stage.leads.map((lead) =>
            lead.id === updatedLead.id ? { ...lead, ...updatedLead } : lead
          ),
        }))
      })
    },
    onSettled: (_data, _error, variables) => {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      if (variables.temperature !== undefined) {
        qc.invalidateQueries({ queryKey: ['agenda-events'] })
      }
    },
  })
}

// ——— Messages ———
export function useDeleteLead() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (leadId: string) => {
      const res = await fetch(`/api/crm/leads/${leadId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível excluir o lead.')
      return data
    },
    onSuccess: (_data, leadId) => {
      qc.removeQueries({ queryKey: ['crm-messages', leadId] })
      qc.removeQueries({ queryKey: ['crm-lead-profile', leadId] })
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['crm-conversations'] })
      qc.invalidateQueries({ queryKey: ['crm-leads-lite'] })
      qc.invalidateQueries({ queryKey: ['crm-follow-up'] })
      qc.invalidateQueries({ queryKey: ['crm-by-label'] })
      qc.invalidateQueries({ queryKey: ['agenda-events'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useLeadMessages(leadId: string | null) {
  return useQuery<Message[]>({
    queryKey: ['crm-messages', leadId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/leads/${leadId}/messages`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      return res.json()
    },
    enabled: !!leadId,
    refetchInterval: 10_000,
  })
}

export function useSendMessage(leadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: string | { content: string; internal?: boolean }) => {
      const payload = typeof input === 'string' ? { content: input } : input
      const res = await fetch(`/api/crm/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send message')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-messages', leadId] })
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useSendAudioMessage(leadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.webm')
      const res = await fetch(`/api/crm/leads/${leadId}/audio`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send audio')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-messages', leadId] })
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useSendMediaMessage(leadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file, file.name)
      const res = await fetch(`/api/crm/leads/${leadId}/media`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send media')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-messages', leadId] })
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateInternalNote(leadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const res = await fetch(`/api/crm/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error('Failed to update note')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-messages', leadId] })
    },
  })
}

export function useWaImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/crm/import/whatsapp', { method: 'POST' })
      let data: Record<string, unknown>
      try {
        data = await res.json()
      } catch {
        throw new Error(`Erro ${res.status}: resposta inválida do servidor`)
      }
      if (!res.ok) throw new Error((data.error as string) || 'Falha na importação')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['crm-tags'] })
      qc.invalidateQueries({ queryKey: ['crm-conversations'] })
      qc.invalidateQueries({ queryKey: ['crm-by-label'] })
      qc.invalidateQueries({ queryKey: ['crm-follow-up'] })
    },
  })
}

export function useCleanupLidLeads() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/crm/leads/cleanup-lid', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error((data.error as string) || 'Falha na limpeza')
      return data as { deleted: number; skipped: number }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['crm-by-label'] })
    },
  })
}

export function useSyncLeadMessages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (leadId: string) => {
      const res = await fetch(`/api/crm/leads/${leadId}/sync`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to sync messages')
      return data
    },
    onSuccess: (data: { imported?: number }, leadId) => {
      qc.invalidateQueries({ queryKey: ['crm-messages', leadId] })
      if (data?.imported && data.imported > 0) {
        qc.invalidateQueries({ queryKey: ['crm-stages'] })
      }
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

export function useLeadsByLabel() {
  return useQuery<LabelColumn[]>({
    queryKey: ['crm-by-label'],
    queryFn: async () => {
      const res = await fetch('/api/crm/by-label')
      if (!res.ok) throw new Error('Failed to fetch leads by label')
      return res.json()
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['crm-conversations'] })
      qc.invalidateQueries({ queryKey: ['crm-by-label'] })
      qc.invalidateQueries({ queryKey: ['crm-lead-profile', leadId] })
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['crm-conversations'] })
      qc.invalidateQueries({ queryKey: ['crm-by-label'] })
      qc.invalidateQueries({ queryKey: ['crm-lead-profile', leadId] })
    },
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

// ——— Follow Up ———
export function useFollowUp() {
  return useQuery<FollowUpColumnData[]>({
    queryKey: ['crm-follow-up'],
    queryFn: async () => {
      const res = await fetch('/api/crm/follow-up')
      if (!res.ok) throw new Error('Failed to fetch follow-up')
      return res.json()
    },
    staleTime: 10_000,
    refetchInterval: 20_000,
  })
}

export function useMoveToFollowUp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (leadId: string) => {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpColumn: 1 }),
      })
      if (!res.ok) throw new Error('Failed to move lead to follow up')
      return res.json()
    },
    onMutate: async (leadId) => {
      await qc.cancelQueries({ queryKey: ['crm-stages'] })
      const prevStages = qc.getQueryData<LeadStage[]>(['crm-stages'])
      if (prevStages) {
        qc.setQueryData<LeadStage[]>(['crm-stages'], prevStages.map((s) => ({
          ...s,
          leads: s.leads.filter((l) => l.id !== leadId),
          _count: {
            leads: s._count.leads - (s.leads.some((l) => l.id === leadId) ? 1 : 0),
          },
        })))
      }
      return { prevStages }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prevStages) qc.setQueryData(['crm-stages'], ctx.prevStages)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['crm-by-label'] })
      qc.invalidateQueries({ queryKey: ['crm-follow-up'] })
    },
  })
}

export function useMoveFromFollowUp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (leadId: string) => {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpColumn: null }),
      })
      if (!res.ok) throw new Error('Failed to remove from follow up')
      return res.json()
    },
    onMutate: async (leadId) => {
      await qc.cancelQueries({ queryKey: ['crm-follow-up'] })
      const prev = qc.getQueryData<FollowUpColumnData[]>(['crm-follow-up'])
      if (prev) {
        qc.setQueryData<FollowUpColumnData[]>(['crm-follow-up'], prev.map((col) => ({
          ...col,
          leads: col.leads.filter((l) => l.id !== leadId),
          _count: { leads: col._count.leads - (col.leads.some((l) => l.id === leadId) ? 1 : 0) },
        })))
      }
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['crm-follow-up'], ctx.prev)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
      qc.invalidateQueries({ queryKey: ['crm-by-label'] })
      qc.invalidateQueries({ queryKey: ['crm-follow-up'] })
    },
  })
}

export function useFollowUpLeadMove() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, column }: { leadId: string; column: number }) => {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpColumn: column }),
      })
      if (!res.ok) throw new Error('Failed to move lead between follow-up columns')
      return res.json()
    },
    onMutate: async ({ leadId, column }) => {
      await qc.cancelQueries({ queryKey: ['crm-follow-up'] })
      const prev = qc.getQueryData<FollowUpColumnData[]>(['crm-follow-up'])
      if (prev) {
        let movedLead: Lead | undefined
        for (const col of prev) {
          const found = col.leads.find((l) => l.id === leadId)
          if (found) { movedLead = found; break }
        }
        if (movedLead) {
          const updated = { ...movedLead, followUpColumn: column }
          qc.setQueryData<FollowUpColumnData[]>(['crm-follow-up'], prev.map((col) => {
            const hadLead = col.leads.some((l) => l.id === leadId)
            const isTarget = col.column === column
            if (hadLead && !isTarget) {
              return { ...col, leads: col.leads.filter((l) => l.id !== leadId), _count: { leads: col._count.leads - 1 } }
            }
            if (isTarget && !hadLead) {
              return { ...col, leads: [updated, ...col.leads], _count: { leads: col._count.leads + 1 } }
            }
            return col
          }))
        }
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['crm-follow-up'], ctx.prev)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-follow-up'] })
    },
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
  return useQuery<{ base64?: string }, Error>({
    queryKey: ['crm-qrcode'],
    queryFn: async () => {
      const res = await fetch('/api/crm/connection/qrcode')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Failed to fetch QR code')
      return data
    },
    enabled,
    retry: 1,
    refetchInterval: enabled ? 20_000 : false,
  })
}

// ——— Follow Up Logs ———
export interface FollowUpLogEntry {
  id: string
  leadId: string
  column: number | null
  createdAt: string
}

export function useFollowUpLogs(leadId: string | null) {
  return useQuery<FollowUpLogEntry[]>({
    queryKey: ['crm-follow-up-logs', leadId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/leads/${leadId}/follow-up-logs`)
      if (!res.ok) throw new Error('Falha ao buscar histórico de follow up')
      return res.json()
    },
    enabled: !!leadId,
    staleTime: 30_000,
  })
}

// ——— Lead Events (reuniões vinculadas) ———
export function useLeadEvents(leadId: string | null) {
  return useQuery({
    queryKey: ['crm-lead-events', leadId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/leads/${leadId}/events`)
      if (!res.ok) throw new Error('Failed to fetch lead events')
      return res.json() as Promise<import('@/types/agenda').AgendaEvent[]>
    },
    enabled: !!leadId,
    staleTime: 30_000,
  })
}

export function useUpdateLeadEventStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; leadId: string; status: import('@/types/agenda').AgendaEventStatus }) => {
      const res = await fetch(`/api/agenda/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update event status')
      return res.json()
    },
    onSuccess: (_data, { leadId }) => {
      qc.invalidateQueries({ queryKey: ['crm-lead-events', leadId] })
      qc.invalidateQueries({ queryKey: ['agenda-events'] })
    },
  })
}

// ——— Realtime (SSE) ———
export function useCrmStream() {
  const qc = useQueryClient()

  useEffect(() => {
    const es = new EventSource('/api/crm/stream')

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as { type: string; leadId?: string; messageId?: string }

        if (event.type === 'new-message') {
          qc.invalidateQueries({ queryKey: ['crm-conversations'] })
          qc.invalidateQueries({ queryKey: ['crm-stages'] })
          qc.invalidateQueries({ queryKey: ['crm-by-label'] })
          qc.invalidateQueries({ queryKey: ['crm-follow-up'] })
          qc.invalidateQueries({ queryKey: ['dashboard'] })
          if (event.leadId) qc.invalidateQueries({ queryKey: ['crm-messages', event.leadId] })
        } else if (event.type === 'message-status') {
          qc.invalidateQueries({ queryKey: ['crm-conversations'] })
          if (event.leadId) qc.invalidateQueries({ queryKey: ['crm-messages', event.leadId] })
        } else if (event.type === 'board-update') {
          qc.invalidateQueries({ queryKey: ['crm-conversations'] })
          qc.invalidateQueries({ queryKey: ['crm-stages'] })
          qc.invalidateQueries({ queryKey: ['crm-by-label'] })
          qc.invalidateQueries({ queryKey: ['crm-follow-up'] })
        } else if (event.type === 'connection-update') {
          qc.invalidateQueries({ queryKey: ['crm-connection'] })
        }
      } catch {
        // fallback: invalida tudo
        qc.invalidateQueries({ queryKey: ['crm-stages'] })
        qc.invalidateQueries({ queryKey: ['crm-messages'] })
        qc.invalidateQueries({ queryKey: ['crm-by-label'] })
        qc.invalidateQueries({ queryKey: ['crm-follow-up'] })
        qc.invalidateQueries({ queryKey: ['crm-connection'] })
      }
    }

    return () => es.close()
  }, [qc])
}
