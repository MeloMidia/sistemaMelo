import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: fromStageId } = await params
  const { toStageId } = await request.json() as { toStageId: string }

  if (!toStageId || toStageId === fromStageId) {
    return NextResponse.json({ error: 'toStageId inválido' }, { status: 400 })
  }

  const result = await prisma.lead.updateMany({
    where: { stageId: fromStageId },
    data: { stageId: toStageId },
  })

  return NextResponse.json({ count: result.count })
}
