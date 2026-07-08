import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findMessages } from '@/lib/evolution-client'
import { emitCrmEvent } from '@/lib/crm-events'
import { importWhatsappMessage } from '@/lib/whatsapp-sync'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return NextResponse.json({ error: 'Lead nao encontrado' }, { status: 404 })

  try {
    // Para contatos @lid, o JID real é o waLid (ex: "12345@lid"), não o phone sintético
    const explicitJid = lead.waLid?.endsWith('@lid') ? lead.waLid : undefined
    const rawMessages = await findMessages(lead.phone, explicitJid)
    let importedCount = 0
    let updatedCount = 0

    for (const item of rawMessages) {
      const result = await importWhatsappMessage(item, { leadId: lead.id })
      if (!result) continue
      if (result.created) importedCount++
      else updatedCount++
    }

    if (importedCount > 0 || updatedCount > 0) {
      emitCrmEvent({ type: 'new-message', leadId: lead.id, message: { importedCount, updatedCount } })
    }

    return NextResponse.json({ success: true, imported: importedCount, updated: updatedCount })
  } catch (error: unknown) {
    console.error('Erro na sincronizacao de mensagens:', error)
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar mensagens'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
