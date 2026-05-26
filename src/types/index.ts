export interface Task {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  isPriorityToday: boolean
  isDoing: boolean
  columnId: string
  order: number
  source: string
  assignee: string | null
  logoUrl: string | null
  notes: string | null
  createdAt: string
  completedAt: string | null
  completedBy: string | null
}

export interface Column {
  id: string
  title: string
  order: number
  createdAt: string
  tasks: Task[]
}
