// src/app/api/crm/webhook/evolution/route.ts
// Recebe eventos da Evolution API em tempo real:
//   messages.upsert   → nova mensagem recebida/enviada
//   messages.update   → atualização de status (lido, entregue, etc.)
//   labels.association → etiqueta adicionada a um contato
//   connection.update → status da conexão WhatsApp mudou

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  normalizeEvolutionEvent,
  extractPayloadList,
  importWhatsappMessage,
  applyLabelAssociation,
  applyWhatsappMessageStatus,
} from '@/lib/whatsapp-sync'
import { emitCrmEvent } from '@/lib/crm-events'

// Sem autenticação de sessão — chamado pela Evolution API, não pelo browser.
// Opcional: defina EVOLUTION_WEBHOOK_SECRET no Vercel para validar a origem.
export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>

    // Verificação de secret opcional
    const secret = process.env.EVOLUTION_WEBHOOK_SECRET
    if (secret) {
      const apikey =
        (request.headers.get('apikey') ??
          request.headers.get('x-api-key') ??
          body.apikey) as string | undefined
      if (apikey !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const event = normalizeEvolutionEvent(body.event ?? body.type)
    // O campo de dados pode vir em body.data ou direto em body
    const data = (body.data ?? body) as Record<string, unknown>

    switch (event) {
      case 'messages.upsert': {
        const items = extractPayloadList(data)
        for (const item of items) {
          try {
            const result = await importWhatsappMessage(item)
            if (result?.lead) {
              emitCrmEvent({ type: 'new-message', leadId: result.lead.id, message: result.message })
            }
          } catch (err) {
            console.error('[webhook] Erro ao importar mensagem:', err)
          }
        }
        break
      }

      case 'messages.update': {
        const items = extractPayloadList(data)
        for (const item of items) {
          try {
            const updated = await applyWhatsappMessageStatus(item)
            if (updated) {
              emitCrmEvent({ type: 'message-status', leadId: updated.leadId, messageId: updated.id, status: updated.status ?? '' })
            }
          } catch (err) {
            console.error('[webhook] Erro ao atualizar status de mensagem:', err)
          }
        }
        break
      }

      case 'labels.association': {
        const items = extractPayloadList(data)
        for (const item of items) {
          try {
            await applyLabelAssociation(item)
          } catch (err) {
            console.error('[webhook] Erro ao aplicar etiqueta:', err)
          }
        }
        emitCrmEvent({ type: 'board-update' })
        break
      }

      case 'connection.update': {
        const state =
          (data.state as string | undefined) ??
          (data.connection as string | undefined)
        if (state) {
          const existing = await prisma.whatsappConnection.findFirst()
          if (existing) {
            await prisma.whatsappConnection.update({ where: { id: existing.id }, data: { status: state } })
          } else {
            await prisma.whatsappConnection.create({ data: { status: state } })
          }
          emitCrmEvent({ type: 'connection-update', status: state })
        }
        break
      }

      default:
        // Eventos desconhecidos ignorados silenciosamente
        break
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook] Erro inesperado:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
