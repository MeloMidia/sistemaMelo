import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CRM_CLOSED_STAGE_NAME, CRM_ENTRY_STAGE_NAME } from '@/lib/crm-pipeline'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, color, order } = await request.json()

  try {
    const currentStage = await prisma.leadStage.findUnique({
      where: { id },
      select: { name: true, isEntry: true, isClosed: true },
    })
    if (!currentStage) return NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 })

    const stage = await prisma.leadStage.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(order !== undefined && { order }),
        ...(currentStage.isEntry || currentStage.name === CRM_ENTRY_STAGE_NAME ? { isEntry: true } : {}),
        ...(currentStage.isClosed || currentStage.name === CRM_CLOSED_STAGE_NAME ? { isClosed: true } : {}),
      },
    })
    return NextResponse.json(stage)
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 })
    }
    throw error
  }
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
