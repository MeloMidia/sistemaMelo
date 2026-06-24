// src/lib/evolution-client.ts
const BASE_URL = (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '')
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
  if (!res.ok) throw new Error(`Evolution API retornou ${res.status}`)
  return res.json()
}

export async function findMessages(phone: string): Promise<any[]> {
  const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
  const res = await evolutionRequest(`/chat/findMessages/${INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({
      where: {
        key: {
          remoteJid: jid
        }
      }
    }),
  })
  if (!res.ok) throw new Error(`Evolution API retornou ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data?.messages || [])
}
