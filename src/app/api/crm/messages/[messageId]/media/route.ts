import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BASE_URL = (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '')
const API_KEY = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageId } = await params

  // 1. Encontrar a mensagem no banco local
  const message = await prisma.message.findUnique({
    where: { id: messageId }
  })

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
        apikey: API_KEY
      },
      body: JSON.stringify({
        message: {
          key: {
            id: message.whatsappMessageId
          }
        },
        convertToMp4: false
      })
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
      return NextResponse.json({ error: 'Nenhum dado de mídia retornado pela Evolution API' }, { status: 400 })
    }

    const mimeType = data.mimetype || 'audio/ogg; codecs=opus'
    // Converter base64 para Buffer
    const buffer = Buffer.from(data.base64, 'base64')

    // Suporte a range requests — obrigatório para <audio> tocar no browser.
    // Sem isso o Chrome recusa a reprodução mesmo com o arquivo válido.
    const rangeHeader = request.headers.get('Range')
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/)
      if (match) {
        const start = match[1] ? parseInt(match[1]) : 0
        const end   = match[2] ? parseInt(match[2]) : buffer.length - 1
        const safeEnd = Math.min(end, buffer.length - 1)
        const chunk = buffer.slice(start, safeEnd + 1)
        return new Response(chunk, {
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

    // Retornar a mídia com o Content-Type correto
    return new Response(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': buffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error: any) {
    console.error('Erro ao recuperar mídia:', error)
    return NextResponse.json({ error: error.message || 'Erro interno ao recuperar mídia' }, { status: 500 })
  }
}
