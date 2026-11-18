import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Resposta mínima que a tela consulta a cada poucos segundos para saber se
// algo mudou no CRM: a mensagem mais nova e a última alteração de lead. Só
// quando um dos dois muda ela baixa as listas pesadas. As duas consultas usam
// índice (Message.createdAt e Lead.updatedAt).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [message, lead] = await Promise.all([
    prisma.message.aggregate({ _max: { createdAt: true } }),
    prisma.lead.aggregate({ _max: { updatedAt: true } }),
  ])

  return NextResponse.json({
    messageAt: message._max.createdAt,
    leadAt: lead._max.updatedAt,
  })
}
