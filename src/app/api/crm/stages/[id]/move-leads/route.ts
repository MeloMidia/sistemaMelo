import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isClosedCrmStage } from '@/lib/crm-pipeline'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: fromStageId } = await params
  const { toStageId } = await request.json() as { toStageId: string }

  if (!toStageId || toStageId === fromStageId) {
    return NextResponse.json({ error: 'toStageId inválido' }, { status: 400 })
  }

  const targetStage = await prisma.leadStage.findUnique({
    where: { id: toStageId },
    select: { name: true, isClosed: true },
  })
  if (!targetStage) {
    return NextResponse.json({ error: 'Etapa de destino não encontrada' }, { status: 404 })
  }

  const result = await prisma.lead.updateMany({
    where: { stageId: fromStageId },
    data: {
      stageId: toStageId,
      closedAt: isClosedCrmStage(targetStage) ? new Date() : null,
    },
  })

  return NextResponse.json({ count: result.count })
}
