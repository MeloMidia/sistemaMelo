// src/app/api/crm/leads/[id]/tags/[tagId]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, tagId } = await params
  await prisma.leadTag.delete({ where: { leadId_tagId: { leadId: id, tagId } } })

  return NextResponse.json({ success: true })
}
