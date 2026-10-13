import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MEDIA_MAX_BYTES, MEDIA_UPLOAD_CONTENT_TYPES, MEDIA_UPLOAD_PATH_PREFIX } from '@/lib/media-upload'

const NOT_CONFIGURED = 'Envio de arquivos acima de 4 MB ainda não está configurado (armazenamento Vercel Blob).'

// O upload() do @vercel/blob descarta a mensagem de erro desta rota, então o
// navegador consulta aqui antes de subir, pra mostrar o motivo certo.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN), error: NOT_CONFIGURED })
}

// Autoriza o navegador a subir mídia acima de 4 MB direto pro Vercel Blob
// (o arquivo não passa por aqui). O link resultante vai pra
// /api/crm/leads/[id]/media, que envia pela Evolution e apaga o blob.
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 })
  }

  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await getServerSession(authOptions)
        if (!session) throw new Error('Não autenticado')
        if (!pathname.startsWith(MEDIA_UPLOAD_PATH_PREFIX)) throw new Error('Caminho de upload inválido')

        return {
          allowedContentTypes: MEDIA_UPLOAD_CONTENT_TYPES,
          maximumSizeInBytes: MEDIA_MAX_BYTES,
          addRandomSuffix: true,
        }
      },
      // O envio acontece na rota de mídia logo após o upload; nada a fazer aqui.
      onUploadCompleted: async () => {},
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
