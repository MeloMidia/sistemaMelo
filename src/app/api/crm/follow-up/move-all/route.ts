import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fromColumn, toColumn } = await request.json()

  if (!fromColumn || !toColumn || fromColumn === toColumn) {
    return NextResponse.json({ error: 'Invalid columns' }, { status: 400 })
  }

  const result = await prisma.lead.updateMany({
    where: { followUpColumn: fromColumn },
    data: { followUpColumn: toColumn, followUpMovedAt: new Date() },
  })

  return NextResponse.json({ count: result.count })
}
