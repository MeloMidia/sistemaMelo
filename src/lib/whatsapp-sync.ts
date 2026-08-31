import type { MessageStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'
import { fetchProfilePictureUrl } from '@/lib/evolution-client'
import { LABEL_TO_STAGE, LABEL_ID_TO_STAGE, STAGE_PRIORITY } from '@/lib/wa-label-map'
import { ensureCrmPipeline } from '@/lib/crm-pipeline'

type UnknownRecord = Record<string, unknown>

export type NormalizedEvolutionEvent =
  | 'messages.upsert'
  | 'messages.update'
  | 'messages.set'
  | 'connection.update'
  | 'qrcode.updated'
  | 'labels.association'

const ACK_STATUS_MAP: Record<string, MessageStatus> = {
  '0': 'SENT',
  '1': 'SENT',
  '2': 'DELIVERED',
  '3': 'READ',
  '4': 'READ',
  pending: 'SENT',
  sent: 'SENT',
  server_ack: 'SENT',
  delivery_ack: 'DELIVERED',
  delivered: 'DELIVERED',
  read: 'READ',
  played: 'READ',
  error: 'FAILED',
  failed: 'FAILED',
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  // Evolution DB pode armazenar fromMe como número 0/1 em JSONB
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return null
}

function child(record: UnknownRecord | null, key: string): UnknownRecord | null {
  return record ? asRecord(record[key]) : null
}

function unwrapMessage(message: unknown): UnknownRecord | null {
  const record = asRecord(message)
  if (!record) return null

  const wrappers = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'documentWithCaptionMessage',
  ]

  for (const wrapper of wrappers) {
    const nested = child(child(record, wrapper), 'message')
    if (nested) return unwrapMessage(nested)
  }

  return record
}

export function normalizeEvolutionEvent(event: unknown): NormalizedEvolutionEvent | null {
  const normalized = asString(event)?.trim().toUpperCase().replace(/[.-]/g, '_')

  switch (normalized) {
    case 'MESSAGES_UPSERT':
    case 'SEND_MESSAGE':
      return 'messages.upsert'
    case 'MESSAGES_UPDATE':
    case 'SEND_MESSAGE_UPDATE':
      return 'messages.update'
    case 'MESSAGES_SET':
      return 'messages.set'
    case 'CONNECTION_UPDATE':
      return 'connection.update'
    case 'QRCODE_UPDATED':
      return 'qrcode.updated'
    case 'LABELS_ASSOCIATION':
    case 'LABELS_EDIT':
      return 'labels.association'
    default:
      return null
  }
}

export function extractPayloadList(data: unknown): UnknownRecord[] {
  if (Array.isArray(data)) return data.map(asRecord).filter((item): item is UnknownRecord => Boolean(item))

  const record = asRecord(data)
  if (!record) return []

  const messages = record.messages
  if (Array.isArray(messages)) {
    return messages.map(asRecord).filter((item): item is UnknownRecord => Boolean(item))
  }

  return [record]
}

function extractKey(raw: UnknownRecord) {
  const key = asRecord(raw.key)
  const remoteJid =
    asString(key?.remoteJid) ??
    asString(raw.remoteJid) ??
    asString(raw.chatId) ??
    asString(raw.sender)
  const id =
    asString(key?.id) ??
    asString(raw.keyId) ??
    asString(raw.messageId) ??
    asString(raw.id)
  const fromMe = asBoolean(key?.fromMe) ?? asBoolean(raw.fromMe) ?? false

  return { remoteJid, id, fromMe }
}

function isGroupOrBroadcast(remoteJid: string): boolean {
  return remoteJid.endsWith('@g.us') || remoteJid.includes('broadcast') || remoteJid === 'status@broadcast'
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const found = asString(value)
    if (found) return found
  }
  return null
}

function extractMessageText(message: UnknownRecord | null): string | null {
  if (!message) return null

  return firstString(
    message.conversation,
    child(message, 'extendedTextMessage')?.text,
    child(message, 'imageMessage')?.caption,
    child(message, 'videoMessage')?.caption,
    child(message, 'documentMessage')?.caption,
    child(message, 'buttonsResponseMessage')?.selectedDisplayText,
    child(message, 'buttonsResponseMessage')?.selectedButtonId,
    child(message, 'listResponseMessage')?.title,
    child(message, 'templateButtonReplyMessage')?.selectedDisplayText,
    child(message, 'reactionMessage')?.text
  )
}

function describeMediaType(message: UnknownRecord | null): string | null {
  if (!message) return null
  if (message.imageMessage) return 'imagem'
  if (message.audioMessage) return 'audio'
  if (message.videoMessage) return 'video'
  if (message.documentMessage) return 'documento'
  if (message.stickerMessage) return 'figurinha'
  if (message.contactMessage || message.contactsArrayMessage) return 'contato'
  if (message.locationMessage || message.liveLocationMessage) return 'localizacao'
  if (message.albumMessage) return 'album'
  return null
}

function normalizeTimestamp(value: unknown): Date {
  if (typeof value === 'number') {
    return new Date(value > 10_000_000_000 ? value : value * 1000)
  }

  if (typeof value === 'string') {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) {
      return new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000)
    }

    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  const record = asRecord(value)
  if (typeof record?.low === 'number') return new Date(record.low * 1000)

  return new Date()
}

function normalizeMessageStatus(status: unknown): MessageStatus | null {
  if (status === null || status === undefined) return null
  const key = String(status).trim().toLowerCase()
  return ACK_STATUS_MAP[key] ?? ACK_STATUS_MAP[key.replace(/\s+/g, '_')] ?? null
}

function buildMessageContent(raw: UnknownRecord, fromMe: boolean): string {
  const message = unwrapMessage(raw.message)
  const text = extractMessageText(message)
  if (text) return text

  const mediaType = describeMediaType(message)
  if (mediaType) {
    return `[midia ${fromMe ? 'enviada' : 'recebida'} - tipo: ${mediaType}]`
  }

  return '[mensagem nao suportada]'
}

async function findOrCreateLead(raw: UnknownRecord, remoteJid: string, fromMe: boolean) {
  const pushName = !fromMe ? asString(raw.pushName) : null

  // Para contatos @lid: buscar pelo waLid primeiro (evita duplicata com phone sintético)
  let lead = remoteJid.endsWith('@lid')
    ? await prisma.lead.findFirst({ where: { waLid: remoteJid } })
    : null

  if (!lead) {
    const phone = normalizePhone(remoteJid)
    lead = await prisma.lead.findUnique({ where: { phone } })
  }

  if (lead) {
    const updates: Record<string, string> = {}
    if (pushName && (!lead.name || lead.name === 'Contato WhatsApp')) updates.name = pushName
    // Aproveita para gravar o waLid real se ainda não estava
    if (!lead.waLid && remoteJid.endsWith('@lid')) updates.waLid = remoteJid
    if (Object.keys(updates).length > 0) {
      lead = await prisma.lead.update({ where: { id: lead.id }, data: updates })
    }
    return lead
  }

  // A caixa de entrada só cria contatos a partir de mensagens recebidas.
  // Eventos de mensagens enviadas para números que ainda não são leads não
  // devem poluir o CRM com conversas iniciadas fora dele.
  if (fromMe) return null

  // Novo contato: determinar phone a armazenar
  const phone = remoteJid.endsWith('@lid')
    ? `lid:${remoteJid.replace('@lid', '')}`
    : normalizePhone(remoteJid)

  const entryStage = await ensureCrmPipeline()
  const newLead = await prisma.lead.create({
    data: {
      phone,
      waLid: remoteJid.endsWith('@lid') ? remoteJid : undefined,
      name: pushName ?? 'Contato WhatsApp',
      stageId: entryStage.id,
    },
  })

  // Busca a foto de perfil em paralelo — não bloqueia o fluxo de importação
  // da mensagem. Se falhar ou a pessoa não tiver foto pública, deixa null.
  fetchProfilePictureUrl(newLead.phone).then((url) => {
    if (url) {
      prisma.lead.update({ where: { id: newLead.id }, data: { profilePicUrl: url } }).catch(() => {})
    }
  })

  return newLead
}

export async function importWhatsappMessage(raw: UnknownRecord, options?: { leadId?: string }) {
  const { remoteJid, id, fromMe } = extractKey(raw)
  if (!remoteJid || !id || isGroupOrBroadcast(remoteJid)) return null

  const lead = options?.leadId
    ? await prisma.lead.findUnique({ where: { id: options.leadId } })
    : await findOrCreateLead(raw, remoteJid, fromMe)

  if (!lead) return null

  const existing = await prisma.message.findUnique({ where: { whatsappMessageId: id } })
  const inboundStatus = fromMe ? normalizeMessageStatus(raw.status) ?? 'SENT' : null
  const content = buildMessageContent(raw, fromMe)
  const createdAt = normalizeTimestamp(raw.messageTimestamp ?? raw.timestamp ?? raw.createdAt)

  const message = await prisma.message.upsert({
    where: { whatsappMessageId: id },
    create: {
      leadId: lead.id,
      whatsappMessageId: id,
      direction: fromMe ? 'OUTBOUND' : 'INBOUND',
      content,
      status: inboundStatus,
      createdAt,
    },
    update: {
      content,
      ...(inboundStatus ? { status: inboundStatus } : {}),
      createdAt,
    },
  })

  // Avança updatedAt apenas quando a mensagem é mais recente que o registro atual
  // (evita que o cron sync de mensagens antigas desordenem o board)
  if (createdAt > lead.updatedAt) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { updatedAt: createdAt },
    })
  }

  return { lead, message, created: !existing }
}

export async function applyLabelAssociation(data: unknown) {
  const d = asRecord(data)
  if (!d) return

  // Extract chatId — Evolution API / Baileys may use different field names
  const assoc = asRecord(d.association) ?? d
  const chatId =
    asString(assoc.chatId) ??
    asString(assoc.id) ??
    asString(d.chatId) ??
    asString(d.id) ??
    asString(d.remoteJid)

  const eventType = asString(assoc.type) ?? asString(d.type) ?? 'add'
  if (eventType === 'remove') return // only handle add events
  if (!chatId || chatId.endsWith('@g.us') || chatId.endsWith('@newsletter')) return

  // Extract label info
  const labelObj = asRecord(assoc.label) ?? asRecord(d.label) ?? asRecord(d)
  const labelId = asString(labelObj?.id) ?? asString(assoc.labelId) ?? asString(d.labelId)
  const labelName = asString(labelObj?.name) ?? asString(d.labelName)

  // Find lead by waLid first (handles @lid format), then by phone
  let lead = await prisma.lead.findFirst({ where: { waLid: chatId } })

  if (!lead && chatId.endsWith('@s.whatsapp.net')) {
    const phone = normalizePhone(chatId)
    lead = await prisma.lead.findUnique({ where: { phone } })
  }

  if (!lead) return

  // Find the CRM tag — prefer lookup by waLabelId, fall back to name
  let tag = labelId
    ? await prisma.crmTag.findUnique({ where: { waLabelId: labelId } })
    : null
  if (!tag && labelName) {
    tag = await prisma.crmTag.findFirst({ where: { name: labelName } })
  }

  // Determine stage — prefer ID lookup (immune to encoding issues), fall back to name
  const resolvedLabelName = labelName ?? tag?.name ?? null
  const targetStageName =
    (labelId ? LABEL_ID_TO_STAGE[labelId] : null) ??
    (resolvedLabelName ? LABEL_TO_STAGE[resolvedLabelName] : null)
  if (targetStageName) {
    const targetStage = await prisma.leadStage.findFirst({ where: { name: targetStageName } })
    if (targetStage) {
      // Only move the lead "forward" in priority — don't downgrade
      const currentStage = lead.stageId
        ? await prisma.leadStage.findUnique({ where: { id: lead.stageId } })
        : null
      const currentPriority = STAGE_PRIORITY[currentStage?.name ?? ''] ?? 0
      const newPriority = STAGE_PRIORITY[targetStageName] ?? 0
      if (newPriority > currentPriority) {
        await prisma.lead.update({ where: { id: lead.id }, data: { stageId: targetStage.id } })
      }
    }
  }

  // Attach tag if found
  if (tag) {
    await prisma.leadTag.upsert({
      where: { leadId_tagId: { leadId: lead.id, tagId: tag.id } },
      create: { leadId: lead.id, tagId: tag.id },
      update: {},
    })
  }
}

export async function applyWhatsappMessageStatus(raw: UnknownRecord) {
  const key = extractKey(raw)
  const whatsappMessageId = key.id ?? asString(raw.keyId)
  if (!whatsappMessageId) return null

  const status = normalizeMessageStatus(raw.status ?? raw.ack ?? raw.update)
  if (!status) return null

  try {
    const message = await prisma.message.update({
      where: { whatsappMessageId },
      data: { status },
    })
    return message
  } catch (error: unknown) {
    const code = asRecord(error)?.code
    if (code === 'P2025') return null
    throw error
  }
}
