import { normalizePhone } from '@/lib/phone'

export const DEFAULT_UNANSWERED_HOURS = 24

export type LeadMessageSnapshot = {
  direction: 'INBOUND' | 'OUTBOUND'
  createdAt: Date | string
}

export type DuplicateLeadSnapshot = {
  id: string
  name: string | null
  phone: string
}

export type DuplicateLeadGroup<T extends DuplicateLeadSnapshot = DuplicateLeadSnapshot> = {
  key: string
  reason: 'phone'
  leads: T[]
}

export function getLatestMessageAwaitingResponse(
  messages: LeadMessageSnapshot[],
  now = new Date(),
  thresholdHours = DEFAULT_UNANSWERED_HOURS,
) {
  const latest = messages[0]
  if (!latest || latest.direction !== 'INBOUND') return null

  const createdAt = new Date(latest.createdAt)
  if (Number.isNaN(createdAt.getTime())) return null

  const threshold = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000)
  return createdAt <= threshold ? createdAt : null
}

export function getDuplicatePhoneKey(phone: string) {
  const normalized = normalizePhone(phone)
  return normalized.length >= 10 ? normalized : null
}

export function groupDuplicateLeads<T extends DuplicateLeadSnapshot>(leads: T[]) {
  const byPhone = new Map<string, T[]>()

  for (const lead of leads) {
    const key = getDuplicatePhoneKey(lead.phone)
    if (!key) continue
    const group = byPhone.get(key) ?? []
    group.push(lead)
    byPhone.set(key, group)
  }

  return Array.from(byPhone.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, reason: 'phone' as const, leads: group }))
}

