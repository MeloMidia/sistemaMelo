'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { BulkCampaign, BulkCampaignLead } from '@/types/campaign'

export function useCampaigns() {
  return useQuery<BulkCampaign[]>({
    queryKey: ['crm-campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/crm/campaigns')
      if (!res.ok) throw new Error('Falha ao carregar campanhas')
      return res.json()
    },
    refetchInterval: 10_000,
  })
}

export function useCampaign(id: string | null) {
  return useQuery<BulkCampaign & { leads: BulkCampaignLead[] }>({
    queryKey: ['crm-campaign', id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/campaigns/${id}`)
      if (!res.ok) throw new Error('Falha ao carregar campanha')
      return res.json()
    },
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data?.status === 'RUNNING' ? 5_000 : 30_000,
  })
}

export function useCreateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      title: string
      message?: string
      mediaBase64?: string
      mediaType?: string
      mimeType?: string
      fileName?: string
      mediaCaption?: string
      scheduledAt?: string
      delaySeconds?: number
      filter: { type: 'all' | 'stages' | 'labels' | 'followUp'; ids?: string[] }
    }) => {
      const res = await fetch('/api/crm/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      let result: Record<string, string> = {}
      try { result = await res.json() } catch {
        if (res.status === 413) throw new Error('Arquivo muito grande. Limite máximo: ~3 MB. Use um vídeo menor ou comprima o arquivo.')
        throw new Error(`Erro ${res.status} ao criar campanha`)
      }
      if (!res.ok) throw new Error(result.error || 'Erro ao criar campanha')
      return result
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-campaigns'] }),
  })
}

export function useCancelCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erro ao cancelar')
      return result
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['crm-campaigns'] })
      qc.invalidateQueries({ queryKey: ['crm-campaign', id] })
    },
  })
}

export function useDeleteCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/campaigns/${id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erro ao excluir')
      return result
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-campaigns'] }),
  })
}
