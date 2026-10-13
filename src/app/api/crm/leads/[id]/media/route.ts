import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { del, get } from '@vercel/blob'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendMediaMessage, type MediaMessageType } from '@/lib/evolution-client'
import { MEDIA_MAX_BYTES, formatMegabytes, isMediaUploadPathname } from '@/lib/media-upload'

// Arquivo grande (até 25 MB) é lido do Blob e enviado à Evolution em base64 —
// pode passar de 1 min.
export const maxDuration = 120

type MediaInput = {
  mimeType: string
  fileName: string
  caption: string
} & (
  /** base64 do arquivo pequeno, que veio no corpo. */
  | { media: string }
  /** Caminho na loja privada do Vercel Blob (arquivo grande). */
  | { blobPathname: string }
)

/**
 * Arquivo até 4 MB chega como multipart; acima disso o navegador sobe pro
 * Vercel Blob e manda só o caminho em JSON (a Vercel recusa corpo > 4,5 MB).
 */
async function readMediaInput(request: Request): Promise<MediaInput | { error: string; status: number }> {
  if ((request.headers.get('content-type') ?? '').includes('application/json')) {
    const body = (await request.json().catch(() => null)) as
      | { pathname?: unknown; fileName?: unknown; mimeType?: unknown; caption?: unknown }
      | null
    if (typeof body?.pathname !== 'string' || !isMediaUploadPathname(body.pathname)) {
      return { error: 'Arquivo inválido', status: 400 }
    }
    return {
      blobPathname: body.pathname,
      mimeType: typeof body.mimeType === 'string' && body.mimeType ? body.mimeType : 'application/octet-stream',
      fileName: typeof body.fileName === 'string' && body.fileName ? body.fileName : `arquivo-${randomUUID()}`,
      caption: typeof body.caption === 'string' ? body.caption.trim() : '',
    }
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const captionValue = formData.get('caption')

  if (!(file instanceof File)) return { error: 'Arquivo nao enviado', status: 400 }
  if (file.size === 0) return { error: 'Arquivo vazio', status: 400 }
  if (file.size > MEDIA_MAX_BYTES) {
    return { error: `Arquivo acima do limite de ${formatMegabytes(MEDIA_MAX_BYTES)}`, status: 413 }
  }

  return {
    media: Buffer.from(await file.arrayBuffer()).toString('base64'),
    mimeType: file.type || 'application/octet-stream',
    fileName: file.name || `arquivo-${randomUUID()}`,
    caption: typeof captionValue === 'string' ? captionValue.trim() : '',
  }
}

function resolveMediaType(mimeType: string): MediaMessageType {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  return 'document'
}

function mediaLabel(mediaType: MediaMessageType): string {
  if (mediaType === 'image') return 'imagem'
  if (mediaType === 'video') return 'video'
  return 'documento'
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const input = await readMediaInput(request)
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: input.status })

  // O blob é só passagem: apaga em qualquer saída daqui pra baixo.
  try {
    return await sendToLead(params, input)
  } finally {
    if ('blobPathname' in input) await del(input.blobPathname).catch(() => {})
  }
}

/** Lê o arquivo da loja privada; null se não estiver lá. */
async function readBlobAsBase64(pathname: string) {
  const stored = await get(pathname, { access: 'private', useCache: false })
  if (stored?.statusCode !== 200) return null
  return Buffer.from(await new Response(stored.stream).arrayBuffer()).toString('base64')
}

async function sendToLead(params: Promise<{ id: string }>, input: MediaInput) {
  if (!checkRateLimit()) {
    return NextResponse.json({ error: 'Limite de envio atingido, aguarde um minuto' }, { status: 429 })
  }

  const { id } = await params
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return NextResponse.json({ error: 'Lead nao encontrado' }, { status: 404 })

  const fromBlob = 'blobPathname' in input
  const media = fromBlob
    ? await readBlobAsBase64(input.blobPathname).catch((error) => {
        console.error('[crm/media] Falha ao ler arquivo do Blob:', error)
        return null
      })
    : input.media
  if (!media) {
    return NextResponse.json({ error: 'Não foi possível ler o arquivo enviado. Tente de novo.' }, { status: 502 })
  }

  const mediaType = resolveMediaType(input.mimeType)
  const content = `[midia enviada - tipo: ${mediaLabel(mediaType)}]`

  try {
    const result = await sendMediaMessage({
      phone: lead.phone,
      mediaType,
      mimeType: input.mimeType,
      media,
      fileName: input.fileName,
      caption: input.caption,
      timeoutMs: fromBlob ? 100_000 : undefined,
    })

    const message = await prisma.message.upsert({
      where: { whatsappMessageId: result.key.id },
      create: {
        leadId: lead.id,
        whatsappMessageId: result.key.id,
        direction: 'OUTBOUND',
        content,
        status: 'SENT',
      },
      update: {
        content,
        status: 'SENT',
      },
    })

    await prisma.lead.update({ where: { id: lead.id }, data: { updatedAt: new Date() } })
    return NextResponse.json(message)
  } catch (error) {
    await prisma.message.create({
      data: {
        leadId: lead.id,
        whatsappMessageId: `failed-${randomUUID()}`,
        direction: 'OUTBOUND',
        content,
        status: 'FAILED',
      },
    })
    await prisma.lead.update({ where: { id: lead.id }, data: { updatedAt: new Date() } })
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    return NextResponse.json(
      {
        error: timedOut
          ? 'A Evolution demorou para responder. Confira na conversa do WhatsApp se o arquivo chegou antes de reenviar.'
          : error instanceof Error ? error.message : 'Falha ao enviar arquivo',
      },
      { status: timedOut ? 504 : 502 }
    )
  }
}
