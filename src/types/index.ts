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
  leadId: string | null
}

export interface Column {
  id: string
  title: string
  order: number
  source: string
  createdAt: string
  tasks: Task[]
}
