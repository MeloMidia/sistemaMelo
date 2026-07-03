import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageId } = await params
  const { content } = await request.json()

  if (typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Conteúdo vazio' }, { status: 400 })
  }

  const message = await prisma.message.findUnique({ where: { id: messageId } })
  if (!message) return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
  if (!message.content.startsWith('[Nota Interna]')) {
    return NextResponse.json({ error: 'Apenas notas internas podem ser editadas' }, { status: 403 })
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: `[Nota Interna] ${content.trim()}` },
  })

  return NextResponse.json(updated)
}
