// src/app/api/crm/leads/[id]/tags/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { tagId } = await request.json()

  try {
    const leadTag = await prisma.leadTag.upsert({
      where: { leadId_tagId: { leadId: id, tagId } },
      update: {},
      create: { leadId: id, tagId },
    })
    return NextResponse.json(leadTag)
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === 'P2003') {
      return NextResponse.json({ error: 'Lead ou tag informado não existe' }, { status: 400 })
    }
    throw error
  }
}
