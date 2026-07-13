// GET /api/crm/webhook/test
// Diagnóstico: simula um evento de mensagem e mostra o resultado passo a passo.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizeEvolutionEvent, extractPayloadList, importWhatsappMessage } from '@/lib/whatsapp-sync'
import { prisma } from '@/lib/prisma'

const SECRET_SET = !!(process.env.EVOLUTION_WEBHOOK_SECRET)

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Pega o primeiro lead com phone válido para testar
  const lead = await prisma.lead.findFirst({
    where: { phone: { not: { startsWith: 'lid:' } } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, phone: true, name: true },
  }).catch((err: Error) => ({ error: err.message }))

  // Simula um payload de messages.upsert
  const phone = 'error' in (lead ?? {}) ? '5511999999999' : (lead as { phone: string }).phone
  const fakePayload = {
    event: 'messages.upsert',
    data: {
      key: {
        remoteJid: `${phone}@s.whatsapp.net`,
        fromMe: false,
        id: `TEST_${Date.now()}`,
      },
      message: { conversation: '[TESTE DE DIAGNÓSTICO - pode ignorar]' },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: 'Teste Diagnóstico',
    },
  }

  const event = normalizeEvolutionEvent(fakePayload.event)
  const data = fakePayload.data as Record<string, unknown>
  const items = extractPayloadList(data)

  let importResult: unknown = null
  let importError: string | null = null

  if (event === 'messages.upsert' && items.length > 0) {
    try {
      importResult = await importWhatsappMessage(items[0])
    } catch (err) {
      importError = err instanceof Error ? err.message : String(err)
    }
  }

  return NextResponse.json({
    diagnostico: {
      secret_configurado: SECRET_SET,
      lead_encontrado: lead,
      evento_normalizado: event,
      items_extraidos: items.length,
      resultado_import: importResult,
      erro_import: importError,
    },
  })
}
