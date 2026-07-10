import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stages } = await request.json() as { stages: Array<{ id: string; order: number }> }

  await prisma.$transaction(
    stages.map((s) =>
      prisma.leadStage.update({ where: { id: s.id }, data: { order: s.order } })
    )
  )

  return NextResponse.json({ success: true })
}
