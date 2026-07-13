/**
 * GET /api/cron/sync-messages
 * Roda a cada 5 minutos via Vercel Cron.
 * Importa mensagens novas da Evolution API para os leads com atividade recente.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findMessages } from '@/lib/evolution-client'
import { importWhatsappMessage } from '@/lib/whatsapp-sync'
import { emitCrmEvent } from '@/lib/crm-events'

const BATCH_SIZE = 30 // leads por execução

export async function GET() {
  try {
    // Leads com phone válido, ordenados pelos que têm mensagens mais antigas no CRM
    // (ou seja, os que mais precisam de sync)
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

    for (const lead of leads) {
      try {
        const explicitJid = lead.waLid?.endsWith('@lid') ? lead.waLid : undefined
        const rawMessages = await findMessages(lead.phone, explicitJid)
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
      } catch {
        // ignora erros individuais, continua com o próximo lead
      }
    }

    return NextResponse.json({ ok: true, leadsChecked: leads.length, leadsWithNew, totalImported })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
