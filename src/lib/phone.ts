/** Normaliza um telefone/JID do WhatsApp para E.164 sem o "+": ex. "5511999999999" */
export function normalizePhone(raw: string): string {
  const digits = raw.replace('@s.whatsapp.net', '').replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}

/**
 * Formats a raw phone number (like '5527999999999') into a readable Brazilian format,
 * or generic international format.
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')

  if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
    const ddd = cleaned.substring(2, 4)
    const number = cleaned.substring(4)
    if (number.length === 9) {
      return `+55 (${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`
    } else {
      return `+55 (${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`
    }
  }

  if (cleaned.length > 10) {
    return `+${cleaned}`
  }

  return phone
}

/**
 * Returns the displayName for a lead:
 * If the name exists and is not 'Contato WhatsApp', returns the name.
 * Otherwise, returns the formatted phone number.
 */
export function getLeadDisplayName(lead: { name?: string | null; phone: string }): string {
  if (lead.name && lead.name !== 'Contato WhatsApp') {
    return lead.name
  }
  return formatPhoneNumber(lead.phone)
}
