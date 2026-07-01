export interface EventCategory {
  id: string
  name: string
  color: string
}

export type AgendaEventStatus = 'AGENDADA' | 'REALIZADA' | 'NAO_REALIZADA' | 'CANCELADA'

export interface AgendaEvent {
  id: string
  title: string
  description?: string | null
  startsAt: string
  endsAt: string
  categoryId: string | null
  category: EventCategory | null
  leadId: string | null
  lead?: { id: string; temperature: string | null; name: string | null; phone: string } | null
  status: AgendaEventStatus
  seriesId: string | null
}
