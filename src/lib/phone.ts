/** Normaliza um telefone/JID do WhatsApp para E.164 sem o "+": ex. "5511999999999" */
export function normalizePhone(raw: string): string {
  const digits = raw.replace('@s.whatsapp.net', '').replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}
