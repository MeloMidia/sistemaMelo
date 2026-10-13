import { NextResponse } from 'next/server'
import { issueSignedToken } from '@vercel/blob'
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MEDIA_MAX_BYTES, isMediaUploadPathname } from '@/lib/media-upload'

const NOT_CONFIGURED = 'Envio de arquivos acima de 4 MB ainda não está configurado (armazenamento Vercel Blob).'

// Loja conectada pelo painel da Vercel: autentica por OIDC com BLOB_STORE_ID
// (não existe BLOB_READ_WRITE_TOKEN) e assina os callbacks com a chave pública.
function isBlobConfigured() {
  return Boolean(process.env.BLOB_STORE_ID && process.env.BLOB_WEBHOOK_PUBLIC_KEY)
}

// O uploadPresigned() do @vercel/blob descarta a mensagem de erro desta rota,
// então o navegador consulta aqui antes de subir, pra mostrar o motivo certo.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ enabled: isBlobConfigured(), error: NOT_CONFIGURED })
}

// Gera a URL pré-assinada pro navegador subir mídia acima de 4 MB direto pro
// Vercel Blob (o arquivo não passa por aqui). O caminho resultante vai pra
// /api/crm/leads/[id]/media, que lê o arquivo, envia pela Evolution e apaga.
export async function POST(request: Request) {
  if (!isBlobConfigured()) {
    return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 })
  }

  const body = (await request.json()) as HandleUploadPresignedBody

  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        const session = await getServerSession(authOptions)
        if (!session) throw new Error('Não autenticado')
        if (!isMediaUploadPathname(pathname)) throw new Error('Caminho de upload inválido')

        const token = await issueSignedToken({
          pathname,
          operations: ['put'],
          maximumSizeInBytes: MEDIA_MAX_BYTES,
        })
        return { token, urlOptions: { maximumSizeInBytes: MEDIA_MAX_BYTES, addRandomSuffix: true } }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error('[crm/media-upload] Falha ao autorizar upload:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
