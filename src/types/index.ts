export interface TaskTagWithTag {
  taskId: string
  tagId: string
  tag: {
    id: string
    name: string
    color: string
  }
}

export interface LeadTaskContext {
  id: string
  name: string | null
  phone: string
  profilePicUrl: string | null
  temperature: string | null
  city: string | null
  state: string | null
  companyName: string | null
  notes: string | null
  stage?: {
    id: string
    name: string
  } | null
  tags: Array<{
    leadId: string
    tagId: string
    tag: {
      id: string
      name: string
      color: string
    }
  }>
}

export interface KanbanTaskContext {
  id: string
  title: string
  source: string
  description: string | null
  dueDate: string | null
  logoUrl: string | null
  notes: string | null
  meetingsCount: number
  adsAtivo: boolean
  promocaoAtiva: boolean
  promocaoAte: string | null
  createdAt: string
  column: {
    id: string
    title: string
    source: string
  } | null
  tags: TaskTagWithTag[]
}

export interface Task {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  isPriorityToday: boolean
  isDoing: boolean
  isWaiting: boolean
  columnId: string
  order: number
  source: string
  assignee: string | null
  logoUrl: string | null
  notes: string | null
  meetingsCount: number
  adsAtivo: boolean
  promocaoAtiva: boolean
  promocaoAte: string | null
  createdAt: string
  completedAt: string | null
  completedBy: string | null
  churnedAt: string | null
  churnReason: string | null
  churnedBy: string | null
  leadId: string | null
  kanbanTaskId: string | null
  tags?: TaskTagWithTag[]
  lead?: LeadTaskContext | null
  kanbanTask?: KanbanTaskContext | null
  negotiation?: {
    negotiatedAt: string
    expectedCloseAt: string | null
    totalValue: number
  } | null
}

export interface Column {
  id: string
  title: string
  color: string | null
  order: number
  source: string
  createdAt: string
  tasks: Task[]
}
