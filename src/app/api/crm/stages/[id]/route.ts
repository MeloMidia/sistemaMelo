import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, color, order } = await request.json()

  const stage = await prisma.leadStage.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
      ...(order !== undefined && { order }),
    },
  })

  return NextResponse.json(stage)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const leadCount = await prisma.lead.count({ where: { stageId: id } })
  if (leadCount > 0) {
    return NextResponse.json(
      { error: 'Mova os leads para outra etapa antes de excluir esta' },
      { status: 400 }
    )
  }

  await prisma.leadStage.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
