/**
 * Limites de envio de mídia pela conversa do CRM, compartilhados entre o
 * navegador e as rotas.
 *
 * A Vercel recusa corpo de requisição acima de 4,5 MB antes da função rodar
 * (responde 413 em texto puro). Até DIRECT_UPLOAD_MAX_BYTES o arquivo vai
 * direto pra rota; acima disso vai do navegador pro Vercel Blob (loja
 * privada) e a rota recebe só o caminho, lê o arquivo de lá e envia.
 */
export const DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024
export const MEDIA_MAX_BYTES = 25 * 1024 * 1024
export const MEDIA_UPLOAD_PATH_PREFIX = 'crm-media/'

export function formatMegabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/**
 * Caminho no Blob só com ASCII seguro (entra na assinatura da URL); o nome
 * original do arquivo vai à parte pro WhatsApp. Mantém o fim, onde está a extensão.
 */
export function mediaUploadPathname(fileName: string) {
  const safeName = fileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .slice(-100)
  return `${MEDIA_UPLOAD_PATH_PREFIX}${safeName.replace(/^[.-]+/, '') || 'arquivo'}`
}

/**
 * Só aceita caminhos dentro da pasta de mídia do CRM. A rota lê o arquivo pela
 * própria loja (credenciais do servidor), então URL de fora nunca entra aqui.
 */
export function isMediaUploadPathname(value: string) {
  return (
    value.startsWith(MEDIA_UPLOAD_PATH_PREFIX) &&
    value.length > MEDIA_UPLOAD_PATH_PREFIX.length &&
    value.length <= 512 &&
    !value.split('/').includes('..')
  )
}
