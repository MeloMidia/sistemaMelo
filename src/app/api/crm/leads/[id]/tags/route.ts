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

  const leadTag = await prisma.leadTag.upsert({
    where: { leadId_tagId: { leadId: id, tagId } },
    update: {},
    create: { leadId: id, tagId },
  })

  return NextResponse.json(leadTag)
}
