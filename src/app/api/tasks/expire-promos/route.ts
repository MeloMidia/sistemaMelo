import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()

  const result = await (prisma.task as any).updateMany({
    where: {
      promocaoAtiva: true,
      promocaoAte: { lt: now },
    },
    data: {
      promocaoAtiva: false,
    },
  })

  return NextResponse.json({ expired: result.count })
}
