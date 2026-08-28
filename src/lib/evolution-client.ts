// src/lib/evolution-client.ts
import { normalizePhone } from '@/lib/phone'
import { getEvolutionBaseUrl } from '@/lib/evolution-url'

const BASE_URL = getEvolutionBaseUrl()
const API_KEY = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

function evolutionRequest(path: string, init?: RequestInit): Promise<Response> {
  if (!BASE_URL || !API_KEY || !INSTANCE) {
    return Promise.reject(new Error('Env vars EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME não configuradas no servidor.'))
  }
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: API_KEY,
      ...(init?.headers ?? {}),
    },
  })
}

export interface SendTextResult {
  key: { id: string }
}

export async function sendTextMessage(phone: string, text: string): Promise<SendTextResult> {
  const res = await evolutionRequest(`/message/sendText/${INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({ number: phone, text }),
  })
  if (!res.ok) throw new Error(`Evolution API retornou ${res.status}`)
  const data = await res.json()
  if (!data?.key?.id) throw new Error('Resposta da Evolution API sem ID de mensagem')
  return data as SendTextResult
}

export interface ConnectionStateResult {
  instance: { state: string }
}

export async function getConnectionState(): Promise<ConnectionStateResult> {
  const res = await evolutionRequest(`/instance/connectionState/${INSTANCE}`)
  if (!res.ok) throw new Error(`Evolution API retornou ${res.status}`)
  return res.json()
}

export interface QrCodeResult {
  base64?: string
}

export async function getQrCode(): Promise<QrCodeResult> {
  const res = await evolutionRequest(`/instance/connect/${INSTANCE}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Evolution API retornou ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  const data = await res.json()
  // Diferentes versões da Evolution API retornam {base64} ou {qrcode:{base64}}
  const base64: string | undefined = data?.base64 ?? data?.qrcode?.base64 ?? undefined
  return { base64 }
}

export async function findMessages(phone: string, explicitJid?: string): Promise<Record<string, unknown>[]> {
  // explicitJid é usado para contatos @lid (ex: "12345@lid") onde o phone
  // sintético ("lid:12345") geraria um JID inválido
  const jid = explicitJid ?? (phone.includes('@') ? phone : `${phone}@s.whatsapp.net`)
  const PAGE_SIZE = 150
  const MAX_PAGES = 20 // teto de segurança: até 3000 mensagens por sync
  const all: Record<string, unknown>[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await evolutionRequest(`/chat/findMessages/${INSTANCE}`, {
      method: 'POST',
      body: JSON.stringify({
        where: {
          key: {
            remoteJid: jid
          }
        },
        page,
        offset: PAGE_SIZE
      }),
    })
    if (!res.ok) throw new Error(`Evolution API retornou ${res.status}`)
    const data = await res.json()
    const messages = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && 'messages' in data && Array.isArray(data.messages)
        ? data.messages
        : []
    const page_items = messages.filter((item: unknown): item is Record<string, unknown> => {
      return Boolean(item) && typeof item === 'object' && !Array.isArray(item)
    })
    all.push(...page_items)
    if (page_items.length < PAGE_SIZE) break // última página
  }

  return all
}

export async function sendAudioMessage(phone: string, base64Audio: string): Promise<SendTextResult> {
  const res = await evolutionRequest(`/message/sendWhatsAppAudio/${INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({ number: phone, audio: base64Audio, ptt: true }),
  })
  if (!res.ok) throw new Error(`Evolution API retornou ${res.status}`)
  const data = await res.json()
  if (!data?.key?.id) throw new Error('Resposta da Evolution API sem ID de mensagem')
  return data as SendTextResult
}

export type MediaMessageType = 'image' | 'video' | 'document'

export async function sendMediaMessage(input: {
  phone: string
  mediaType: MediaMessageType
  mimeType: string
  base64Media: string
  fileName: string
  caption?: string
}): Promise<SendTextResult> {
  const res = await evolutionRequest(`/message/sendMedia/${INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({
      number: input.phone,
      mediatype: input.mediaType,
      mimetype: input.mimeType,
      media: input.base64Media,
      fileName: input.fileName,
      caption: input.caption ?? '',
    }),
  })
  if (!res.ok) throw new Error(`Evolution API retornou ${res.status}`)
  const data = await res.json()
  if (!data?.key?.id) throw new Error('Resposta da Evolution API sem ID de mensagem')
  return data as SendTextResult
}

export interface WhatsappLabel {
  id: string
  name: string
  color?: string | number
}

export async function findLabels(): Promise<WhatsappLabel[]> {
  try {
    const res = await evolutionRequest(`/label/findLabels/${INSTANCE}`)
    if (!res.ok) {
      console.error(`Evolution API findLabels retornou status ${res.status}`)
      return []
    }
    const data = await res.json()
    return Array.isArray(data) ? (data as WhatsappLabel[]) : []
  } catch (err) {
    console.error('Erro ao buscar etiquetas do WhatsApp:', err)
    return []
  }
}

export async function fetchProfilePictureUrl(phone: string): Promise<string | null> {
  try {
    const res = await evolutionRequest(`/chat/fetchProfilePictureUrl/${INSTANCE}`, {
      method: 'POST',
      body: JSON.stringify({ number: phone }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data?.profilePictureUrl === 'string' ? data.profilePictureUrl : null
  } catch {
    return null
  }
}

export async function handleLabel(input: {
  phone: string
  labelId: string
  action: 'add' | 'remove'
}): Promise<void> {
  const cleanPhone = normalizePhone(input.phone)
  const res = await evolutionRequest(`/label/handleLabel/${INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({
      number: cleanPhone,
      labelId: input.labelId,
      action: input.action,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error(`Evolution API handleLabel retornou status ${res.status}: ${text}`)
    throw new Error(`Evolution API handleLabel retornou ${res.status}`)
  }
}
