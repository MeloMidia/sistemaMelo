/**
 * Limites de envio de mídia pela conversa do CRM, compartilhados entre o
 * navegador e as rotas.
 *
 * A Vercel recusa corpo de requisição acima de 4,5 MB antes da função rodar
 * (responde 413 em texto puro). Até DIRECT_UPLOAD_MAX_BYTES o arquivo vai
 * direto pra rota; acima disso vai do navegador pro Vercel Blob e a rota só
 * recebe o link, que a Evolution baixa pra enviar.
 */
export const DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024
export const MEDIA_MAX_BYTES = 25 * 1024 * 1024
export const MEDIA_UPLOAD_CONTENT_TYPES = ['image/*', 'video/*', 'application/*', 'text/*']
export const MEDIA_UPLOAD_PATH_PREFIX = 'crm-media/'

export function formatMegabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/** Só aceita links do próprio Vercel Blob — a rota de envio não manda URL arbitrária pra Evolution. */
export function isBlobStoreUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.endsWith('.public.blob.vercel-storage.com')
  } catch {
    return false
  }
}
