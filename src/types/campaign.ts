export type BulkCampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'DONE' | 'CANCELLED'
export type BulkLeadStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'

export interface BulkCampaign {
  id: string
  title: string
  message: string | null
  mediaType: string | null
  mimeType: string | null
  fileName: string | null
  mediaCaption: string | null
  // mediaBase64 is NOT included in list responses (too large)
  status: BulkCampaignStatus
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  totalLeads: number
  sentCount: number
  failedCount: number
  delaySeconds: number
  createdAt: string
  updatedAt: string
}

export interface BulkCampaignLead {
  id: string
  campaignId: string
  leadId: string
  status: BulkLeadStatus
  sentAt: string | null
  error: string | null
  lead: {
    id: string
    name: string | null
    phone: string
  }
}
