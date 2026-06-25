export interface EventCategory {
  id: string
  name: string
  color: string
}

export interface AgendaEvent {
  id: string
  title: string
  startsAt: string
  endsAt: string
  categoryId: string | null
  category: EventCategory | null
}
