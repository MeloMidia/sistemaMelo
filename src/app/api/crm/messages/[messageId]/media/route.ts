import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BASE_URL = (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '')
const API_KEY = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

// Cache em memória para evitar múltiplas chamadas à Evolution API pelo mesmo áudio.
// O browser faz várias range requests em sequência (probe, seek, buffer) para o
// mesmo arquivo — sem cache cada uma dispararia um novo getBase64FromMediaMessage.
// TTL de 5 min é suficiente para cobrir toda a sessão de playback.
type CacheEntry = { buffer: Buffer; mimeType: string; ts: number }
const mediaCache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

function getCached(key: string): CacheEntry | null {
  const entry = mediaCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { mediaCache.delete(key); return null }
  return entry
}

function serveBuffer(buffer: Buffer, mimeType: string, rangeHeader: string | null): Response {
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/)
    if (match) {
      const start   = match[1] ? parseInt(match[1]) : 0
      const end     = match[2] ? parseInt(match[2]) : buffer.length - 1
      const safeEnd = Math.min(end, buffer.length - 1)
      const chunk   = buffer.slice(start, safeEnd + 1)
      return new Response(new Uint8Array(chunk), {
        status: 206,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': chunk.length.toString(),
          'Content-Range': `bytes ${start}-${safeEnd}/${buffer.length}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': buffer.length.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageId } = await params
  const rangeHeader = request.headers.get('Range')

  // Servir do cache se ainda válido (evita múltiplas chamadas à Evolution API)
  const cached = getCached(messageId)
  if (cached) {
    return serveBuffer(cached.buffer, cached.mimeType, rangeHeader)
  }

  // 1. Encontrar a mensagem no banco local
  const message = await prisma.message.findUnique({ where: { id: messageId } })

  if (!message) {
    return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
  }

  // 2. Verificar se a mensagem possui um ID de WhatsApp válido
  if (!message.whatsappMessageId || message.whatsappMessageId.startsWith('failed-')) {
    return NextResponse.json({ error: 'Mensagem sem ID válido do WhatsApp' }, { status: 400 })
  }

  // 3. Chamar a Evolution API para buscar o base64 da mídia
  if (!BASE_URL || !API_KEY || !INSTANCE) {
    return NextResponse.json({ error: 'Evolution API não configurada no servidor' }, { status: 500 })
  }

  try {
    const response = await fetch(`${BASE_URL}/chat/getBase64FromMediaMessage/${INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: API_KEY,
      },
      body: JSON.stringify({
        message: { key: { id: message.whatsappMessageId } },
        convertToMp4: false,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Erro na Evolution API getBase64FromMediaMessage:', errText)
      return NextResponse.json(
        { error: `Erro ao buscar mídia no WhatsApp: ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    if (!data?.base64) {
      return NextResponse.json(
        { error: 'Nenhum dado de mídia retornado pela Evolution API' },
        { status: 400 }
      )
    }

    // WhatsApp usa opus dentro de ogg — garantir codec no mime type
    const mimeType = data.mimetype?.includes('ogg')
      ? 'audio/ogg; codecs=opus'
      : (data.mimetype || 'audio/ogg; codecs=opus')

    const buffer = Buffer.from(data.base64, 'base64')

    // Guardar no cache para range requests subsequentes do mesmo arquivo
    mediaCache.set(messageId, { buffer, mimeType, ts: Date.now() })

    return serveBuffer(buffer, mimeType, rangeHeader)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro interno ao recuperar mídia'
    console.error('Erro ao recuperar mídia:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
