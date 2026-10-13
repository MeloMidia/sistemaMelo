import type { Message } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Última mensagem (sem notas internas) de cada lead, numa consulta só.
 *
 * O `messages: { orderBy, take: 1 }` aninhado do Prisma NÃO põe LIMIT no SQL:
 * busca todas as mensagens dos leads (com o conteúdo inteiro) e corta em
 * memória — nas listas do CRM (até 250 leads, a cada poucos segundos) isso
 * carregava o histórico inteiro de conversas. Aqui o LATERAL usa o índice
 * (leadId, createdAt) e devolve no máximo uma linha por lead.
 */
export async function findLastMessages(leadIds: string[]): Promise<Map<string, Message>> {
  if (leadIds.length === 0) return new Map()

  const rows = await prisma.$queryRaw<Message[]>`
    SELECT m.*
    FROM unnest(${leadIds}::text[]) AS l(id)
    CROSS JOIN LATERAL (
      SELECT *
      FROM "Message"
      WHERE "leadId" = l.id AND "whatsappMessageId" NOT LIKE 'note-%'
      ORDER BY "createdAt" DESC
      LIMIT 1
    ) m
  `
  return new Map(rows.map((row) => [row.leadId, row]))
}

/** Mesmo formato do `include: { messages: { take: 1 } }`: `messages` com 0 ou 1 item. */
export async function withLastMessage<T extends { id: string }>(leads: T[]): Promise<Array<T & { messages: Message[] }>> {
  const lastByLead = await findLastMessages(leads.map((lead) => lead.id))
  return leads.map((lead) => {
    const last = lastByLead.get(lead.id)
    return { ...lead, messages: last ? [last] : [] }
  })
}
