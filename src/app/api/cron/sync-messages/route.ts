import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findMessages } from '@/lib/evolution-client'
import { importWhatsappMessage } from '@/lib/whatsapp-sync'
import { emitCrmEvent } from '@/lib/crm-events'

const BATCH_SIZE = 30

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      where: {
        phone: { not: { startsWith: 'lid:' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: BATCH_SIZE,
      select: { id: true, phone: true, waLid: true },
    })

    let totalImported = 0
    let leadsWithNew = 0
    let leadsWithError = 0
    let totalFetched = 0
    const errors: string[] = []

    for (const lead of leads) {
      try {
        const explicitJid = lead.waLid?.endsWith('@lid') ? lead.waLid : undefined
        const rawMessages = await findMessages(lead.phone, explicitJid)
        totalFetched += rawMessages.length
        let importedCount = 0

        for (const item of rawMessages) {
          const result = await importWhatsappMessage(item, { leadId: lead.id })
          if (result?.created) importedCount++
        }

        if (importedCount > 0) {
          leadsWithNew++
          totalImported += importedCount
          emitCrmEvent({ type: 'new-message', leadId: lead.id, message: { importedCount } })
        }
      } catch (err) {
        leadsWithError++
        const msg = err instanceof Error ? err.message : String(err)
        if (errors.length < 3) errors.push(msg)
      }
    }

    return NextResponse.json({
      ok: true,
      leadsChecked: leads.length,
      totalFetched,
      leadsWithNew,
      totalImported,
      leadsWithError,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
