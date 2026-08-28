import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const lead = await prisma.lead.update({
      where: { id },
      data: { lastReadAt: new Date() },
      select: { id: true, lastReadAt: true },
    })
    return NextResponse.json(lead)
  } catch {
    return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
  }
}
