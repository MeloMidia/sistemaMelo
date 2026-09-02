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

export interface Negotiation {
  id: string
  leadId: string
  negotiatedAt: string
  expectedCloseAt: string | null
  service: string
  quantity: number
  unitPrice: number
  discount: number
  totalValue: number
  notes: string | null
  responsible: CrmUser | null
  task: { id: string; columnId: string; title: string; dueDate: string | null }
  tags: { tag: CrmTag }[]
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
  stageId: string | null
  assignedToId: string | null
  assignedTo: CrmUser | null
  value: number | null
  temperature: string | null
  notes: string | null
  cpf?: string | null
  email?: string | null
  city?: string | null
  state?: string | null
  neighborhood?: string | null
  postalCode?: string | null
  address?: string | null
  instagram?: string | null
  nickname?: string | null
  mercadoLivreStatus?: string | null
  businessArea?: string | null
  companyName?: string | null
  mlKnowledge?: string | null
  stock?: string | null
  revenue?: string | null
  employees?: string | null
  partners?: string | null
  profilePicUrl: string | null
  followUpColumn: number | null
  followUpMovedAt: string | null
  lastReadAt?: string | null
  tags: LeadTagWithTag[]
  messages: Message[]
  _count: { messages: number; tasks?: number }
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
  isEntry?: boolean
  isClosed?: boolean
  leads: Lead[]
  _count: { leads: number }
}

export interface LabelColumn {
  id: string
  name: string
  color: string
  leads: Lead[]
  _count: { leads: number }
}

export interface FollowUpColumnData {
  column: number
  leads: Lead[]
  _count: { leads: number }
}

export interface WhatsappConnection {
  id?: string
  status: string
  updatedAt?: string
}

export interface CrmConversation {
  id: string
  name: string | null
  phone: string
  profilePicUrl: string | null
  updatedAt: string
  lastReadAt: string | null
  stage: { id: string; name: string; color: string } | null
  tags: LeadTagWithTag[]
  isUnread: boolean
  lastMessage: Pick<Message, 'id' | 'content' | 'direction' | 'status' | 'createdAt'> | null
}
