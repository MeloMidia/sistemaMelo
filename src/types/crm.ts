export interface CrmTag {
  id: string
  name: string
  color: string
}

export interface LeadTagWithTag {
  leadId: string
  tagId: string
  tag: CrmTag
}

export interface CrmUser {
  id: string
  name: string
}

export interface Message {
  id: string
  leadId: string
  whatsappMessageId: string
  direction: 'INBOUND' | 'OUTBOUND'
  content: string
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null
  createdAt: string
}

export interface Lead {
  id: string
  name: string | null
  phone: string
  stageId: string
  assignedToId: string | null
  assignedTo: CrmUser | null
  value: number | null
  temperature: string | null
  notes: string | null
  profilePicUrl: string | null
  tags: LeadTagWithTag[]
  messages: Message[]
  _count: { messages: number }
  createdAt: string
  updatedAt: string
}

export interface LeadLite {
  id: string
  name: string | null
  phone: string
  temperature: string | null
  notes: string | null
}

export interface LeadStage {
  id: string
  name: string
  order: number
  color: string
  leads: Lead[]
}

export interface WhatsappConnection {
  id?: string
  status: string
  updatedAt?: string
}
