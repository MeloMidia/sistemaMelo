// src/app/api/crm/leads/[id]/tags/[tagId]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findLabels, handleLabel } from '@/lib/evolution-client'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, tagId } = await params

  try {
    // Sincroniza a remoção da etiqueta no WhatsApp
    try {
      const lead = await prisma.lead.findUnique({ where: { id } })
      const tag = await prisma.crmTag.findUnique({ where: { id: tagId } })
      if (lead && tag) {
        const labels = await findLabels()
        const matched = labels.find((l) => l.name.trim().toLowerCase() === tag.name.trim().toLowerCase())
        if (matched) {
          await handleLabel({
            phone: lead.phone,
            labelId: matched.id,
            action: 'remove',
          })
        }
      }
    } catch (err) {
      console.error('Erro ao remover etiqueta do WhatsApp:', err)
    }

    await prisma.leadTag.delete({ where: { leadId_tagId: { leadId: id, tagId } } })
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code !== 'P2025') throw error // já desvinculado — idempotente
  }

  return NextResponse.json({ success: true })
}
