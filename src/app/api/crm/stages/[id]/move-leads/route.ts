import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
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

  // SQL direto em vez de updateMany: o @updatedAt do Prisma marcaria todos
  // os leads movidos como "ativos agora", embaralhando a ordem das colunas
  // (ordenadas por updatedAt) e o cron de sync (que pega os mais recentes).
  // O ISO em UTC cast pra timestamp grava igual ao Prisma, sem depender do
  // fuso da sessão do banco.
  const closedAt = isClosedCrmStage(targetStage)
    ? Prisma.sql`${new Date().toISOString()}::timestamp(3)`
    : Prisma.sql`NULL`

  const count = await prisma.$executeRaw`
    UPDATE "Lead"
    SET "stageId" = ${toStageId}, "closedAt" = ${closedAt}
    WHERE "stageId" = ${fromStageId}
  `

  return NextResponse.json({ count })
}
