/**
 * Produz uma URL pública válida para a Evolution API.
 *
 * Alguns provedores exibem somente o domínio (por exemplo, Railway). O fetch
 * do Node exige protocolo, então preservamos URLs completas e acrescentamos
 * HTTPS quando o valor fornecido contém apenas o host.
 */
export function getEvolutionBaseUrl(value = process.env.EVOLUTION_API_URL ?? ''): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return ''

  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
}
