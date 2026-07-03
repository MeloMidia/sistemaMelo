import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Remove all leadTags created by the WA import (tags that have a waLabelId)
  const waTags = await prisma.crmTag.findMany({ where: { waLabelId: { not: null } }, select: { id: true } })
  const waTagIds = waTags.map((t) => t.id)
  const { count: tagsRemoved } = await prisma.leadTag.deleteMany({
    where: { tagId: { in: waTagIds } },
  })

  // Reset all lead stages back to the first stage (Novo Contato)
  const firstStage = await prisma.leadStage.findFirst({ orderBy: { order: 'asc' } })
  if (!firstStage) return NextResponse.json({ error: 'Nenhum stage encontrado' }, { status: 500 })

  const { count: leadsReset } = await prisma.lead.updateMany({
    data: { stageId: firstStage.id },
  })

  return NextResponse.json({ leadsReset, tagsRemoved, resetTo: firstStage.name })
}
