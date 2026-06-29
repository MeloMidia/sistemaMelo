// src/app/api/crm/leads/[id]/tags/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findLabels, handleLabel } from '@/lib/evolution-client'

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

    // Sincroniza a etiqueta com o WhatsApp
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
            action: 'add',
          })
        }
      }
    } catch (err) {
      console.error('Erro ao sincronizar etiqueta com WhatsApp:', err)
    }

    return NextResponse.json(leadTag)
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === 'P2003') {
      return NextResponse.json({ error: 'Lead ou tag informado não existe' }, { status: 400 })
    }
    throw error
  }
}
