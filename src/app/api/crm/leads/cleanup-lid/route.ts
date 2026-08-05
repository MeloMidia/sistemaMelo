/**
 * DELETE /api/crm/leads/cleanup-lid
 *
 * Remove leads com phone iniciando em "lid:" que não têm nenhuma mensagem.
 * Esses leads são contatos @lid do WhatsApp que nunca trocaram mensagem
 * e cujo número real não pôde ser resolvido — são fantasmas inutilizáveis.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Encontra leads lid: sem mensagens e sem eventos de agenda
  const lidLeads = await prisma.lead.findMany({
    where: { phone: { startsWith: 'lid:' } },
    select: {
      id: true,
      _count: { select: { messages: true, events: true, tasks: true } },
    },
  })

  // Só deleta os que realmente não têm nenhuma atividade
  const toDelete = lidLeads
    .filter((l) => l._count.messages === 0 && l._count.events === 0 && l._count.tasks === 0)
    .map((l) => l.id)

  if (toDelete.length === 0) {
    return NextResponse.json({ deleted: 0, skipped: lidLeads.length })
  }

  const result = await prisma.lead.deleteMany({
    where: { id: { in: toDelete } },
  })

  return NextResponse.json({
    deleted: result.count,
    skipped: lidLeads.length - result.count,
  })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const total = await prisma.lead.count({ where: { phone: { startsWith: 'lid:' } } })
  const withMessages = await prisma.lead.count({
    where: {
      phone: { startsWith: 'lid:' },
      messages: { some: {} },
    },
  })

  return NextResponse.json({ total, withMessages, deletable: total - withMessages })
}
