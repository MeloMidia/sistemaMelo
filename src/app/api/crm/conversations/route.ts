import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findLabels } from '@/lib/evolution-client'
import { prisma } from '@/lib/prisma'
import { LABEL_ID_TO_NAME, WA_COLORS } from '@/lib/wa-label-map'
import { getEvolutionBaseUrl } from '@/lib/evolution-url'

const MAX_CONVERSATIONS = 250

type ConversationLead = {
  id: string
  phone: string
  waLid: string | null
  tags: Array<{
    leadId: string
    tagId: string
    tag: { id: string; name: string; color: string }
  }>
}

type ConversationTag = ConversationLead['tags'][number]

type CrmTagLookup = {
  id: string
  name: string
  color: string
  waLabelId: string | null
}

type WhatsappLabelLookup = {
  name: string
  color?: string | number | null
}

type WhatsappChatLabelRow = {
  remoteJid: string
  labels: unknown
  phoneJid: string | null
}

function parseLabelIds(labels: unknown): string[] {
  let rawLabels = labels
  if (typeof rawLabels === 'string') {
    try { rawLabels = JSON.parse(rawLabels) } catch { return [] }
  }
  if (!Array.isArray(rawLabels)) return []

  return rawLabels
    .map((entry) => {
      if (typeof entry === 'string' || typeof entry === 'number') return String(entry)
      if (entry && typeof entry === 'object' && 'id' in entry) {
        return String((entry as Record<string, unknown>).id)
      }
      if (entry && typeof entry === 'object' && 'labelId' in entry) {
        return String((entry as Record<string, unknown>).labelId)
      }
      return ''
    })
    .filter(Boolean)
}

function labelColor(value: string | number | undefined): string {
  if (typeof value === 'number') return WA_COLORS[value] ?? '#64748b'
  return value || '#64748b'
}

function buildLeadJidLookups(leads: ConversationLead[]) {
  const jidToLeadId = new Map<string, string>()
  const phoneJidToLeadId = new Map<string, string>()
  for (const lead of leads) {
    if (!lead.phone.startsWith('lid:')) {
      const phoneJid = `${lead.phone}@s.whatsapp.net`
      jidToLeadId.set(phoneJid, lead.id)
      phoneJidToLeadId.set(phoneJid, lead.id)
    }
    if (lead.waLid) jidToLeadId.set(lead.waLid, lead.id)
  }
  return { jidToLeadId, phoneJidToLeadId }
}

function appendWhatsappTag(
  tagsByLeadId: Map<string, ConversationTag[]>,
  input: {
    leadId: string
    labelId: string
    crmTagByLabelId: Map<string, CrmTagLookup>
    whatsappLabelById: Map<string, WhatsappLabelLookup>
  }
) {
  const tags = tagsByLeadId.get(input.leadId) ?? []
  const crmTag = input.crmTagByLabelId.get(input.labelId)
  const whatsappLabel = input.whatsappLabelById.get(input.labelId)
  const tag = crmTag
    ? { id: crmTag.id, name: crmTag.name, color: crmTag.color }
    : {
        id: `wa:${input.labelId}`,
        name: LABEL_ID_TO_NAME[input.labelId] ?? whatsappLabel?.name ?? `Etiqueta ${input.labelId}`,
        color: labelColor(whatsappLabel?.color ?? undefined),
      }

  if (tags.some((entry) => entry.tagId === tag.id)) return

  tags.push({ leadId: input.leadId, tagId: tag.id, tag })
  tagsByLeadId.set(input.leadId, tags)
}

function leadIdForWhatsappRow(
  row: WhatsappChatLabelRow,
  lookups: ReturnType<typeof buildLeadJidLookups>
): string | undefined {
  return lookups.jidToLeadId.get(row.remoteJid) ?? (
    row.phoneJid ? lookups.phoneJidToLeadId.get(row.phoneJid) : undefined
  )
}

async function fetchEvolutionInstanceId(client: import('pg').Client): Promise<string | null> {
  const instance = process.env.EVOLUTION_INSTANCE_NAME
  if (!instance) return null

  try {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM "Instance" WHERE name = $1 LIMIT 1`,
      [instance]
    )
    return result.rows[0]?.id ?? null
  } catch {
    return null
  }
}

async function fetchWhatsappLabelsFromDb(
  client: import('pg').Client,
  instanceId: string | null
): Promise<Array<{ labelId: string; name: string; color: string | number | null }>> {
  try {
    const result = instanceId
      ? await client.query<{ labelId: string; name: string; color: string | number | null }>(
          `SELECT "labelId", name, color FROM "Label" WHERE "instanceId" = $1`,
          [instanceId]
        )
      : await client.query<{ labelId: string; name: string; color: string | number | null }>(
          `SELECT "labelId", name, color FROM "Label"`
        )
    return result.rows
  } catch {
    return []
  }
}

async function fetchWhatsappChatLabelRowsFromDb(
  client: import('pg').Client,
  instanceId: string | null,
  lookups: ReturnType<typeof buildLeadJidLookups>
): Promise<WhatsappChatLabelRow[]> {
  const rows: WhatsappChatLabelRow[] = []
  const directJids = [...lookups.jidToLeadId.keys()]
  const phoneJids = [...lookups.phoneJidToLeadId.keys()]

  if (directJids.length > 0) {
    const direct = instanceId
      ? await client.query<{ remoteJid: string; labels: unknown }>(
          `SELECT "remoteJid", labels
           FROM "Chat"
           WHERE "instanceId" = $1
             AND "remoteJid" = ANY($2::text[])
             AND labels IS NOT NULL
             AND labels::text != 'null'
             AND labels::text != '[]'`,
          [instanceId, directJids]
        )
      : await client.query<{ remoteJid: string; labels: unknown }>(
          `SELECT "remoteJid", labels
           FROM "Chat"
           WHERE "remoteJid" = ANY($1::text[])
             AND labels IS NOT NULL
             AND labels::text != 'null'
             AND labels::text != '[]'`,
          [directJids]
        )
    rows.push(...direct.rows.map((row) => ({ ...row, phoneJid: null })))
  }

  if (phoneJids.length > 0) {
    try {
      const viaMessage = instanceId
        ? await client.query<{ remoteJid: string; labels: unknown; phoneJid: string }>(
            `SELECT DISTINCT c."remoteJid", c.labels, m.key->>'remoteJidAlt' AS "phoneJid"
             FROM "Chat" c
             INNER JOIN "Message" m
               ON m.key->>'remoteJid' = c."remoteJid"
              AND m."instanceId" = c."instanceId"
             WHERE c."instanceId" = $1
               AND c."remoteJid" LIKE '%@lid'
               AND m.key->>'remoteJidAlt' = ANY($2::text[])
               AND c.labels IS NOT NULL
               AND c.labels::text != 'null'
               AND c.labels::text != '[]'`,
            [instanceId, phoneJids]
          )
        : await client.query<{ remoteJid: string; labels: unknown; phoneJid: string }>(
            `SELECT DISTINCT c."remoteJid", c.labels, m.key->>'remoteJidAlt' AS "phoneJid"
             FROM "Chat" c
             INNER JOIN "Message" m
               ON m.key->>'remoteJid' = c."remoteJid"
             WHERE c."remoteJid" LIKE '%@lid'
               AND m.key->>'remoteJidAlt' = ANY($1::text[])
               AND c.labels IS NOT NULL
               AND c.labels::text != 'null'
               AND c.labels::text != '[]'`,
            [phoneJids]
          )
      rows.push(...viaMessage.rows)
    } catch {
      // Algumas instalações da Evolution não têm remoteJidAlt na tabela Message.
    }

    try {
      const viaIsOnWhatsapp = await client.query<{ remoteJid: string; labels: unknown; phoneJid: string }>(
        `SELECT c."remoteJid", c.labels, i."remoteJid" AS "phoneJid"
         FROM "Chat" c
         INNER JOIN "IsOnWhatsapp" i
           ON i.lid = c."remoteJid"
         WHERE i."remoteJid" = ANY($1::text[])
           AND c.labels IS NOT NULL
           AND c.labels::text != 'null'
           AND c.labels::text != '[]'`,
        [phoneJids]
      )
      rows.push(...viaIsOnWhatsapp.rows)
    } catch {
      // Tabela opcional em algumas versões da Evolution.
    }
  }

  return rows
}

async function fetchWhatsappTagsFromDb(leads: ConversationLead[]): Promise<Map<string, ConversationTag[]>> {
  const dbUrl = process.env.EVOLUTION_DB_URL
  if (!dbUrl || leads.length === 0) return new Map()

  const lookups = buildLeadJidLookups(leads)

  const { Client } = await import('pg')
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()
    const instanceId = await fetchEvolutionInstanceId(client)
    const [rows, whatsappLabels, crmTags] = await Promise.all([
      fetchWhatsappChatLabelRowsFromDb(client, instanceId, lookups),
      fetchWhatsappLabelsFromDb(client, instanceId),
      prisma.crmTag.findMany({ select: { id: true, name: true, color: true, waLabelId: true } }),
    ])

    const whatsappLabelById = new Map(whatsappLabels.map((label) => [String(label.labelId), label]))
    const crmTagByLabelId = new Map(crmTags.filter((tag) => tag.waLabelId).map((tag) => [tag.waLabelId!, tag]))
    const tagsByLeadId = new Map<string, ConversationTag[]>()

    for (const row of rows) {
      const leadId = leadIdForWhatsappRow(row, lookups)
      if (!leadId) continue

      for (const labelId of parseLabelIds(row.labels)) {
        appendWhatsappTag(tagsByLeadId, { leadId, labelId, crmTagByLabelId, whatsappLabelById })
      }
    }

    return tagsByLeadId
  } catch (error) {
    console.error('[crm/conversations] Erro ao buscar etiquetas da Evolution:', error)
    return new Map()
  } finally {
    await client.end().catch(() => {})
  }
}

function normalizeChatItems(data: unknown): Array<Record<string, unknown>> {
  let items: unknown[] = []
  if (Array.isArray(data)) {
    items = data
  } else if (data && typeof data === 'object') {
    const chats = (data as Record<string, unknown>).chats
    if (Array.isArray(chats)) items = chats
  }

  return items.filter((item: unknown): item is Record<string, unknown> => {
    return Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  })
}

function extractChatJid(chat: Record<string, unknown>): string | null {
  const remoteJid = chat.remoteJid
  if (typeof remoteJid === 'string') return remoteJid

  const id = chat.id
  if (typeof id === 'string' && (id.endsWith('@s.whatsapp.net') || id.endsWith('@lid'))) return id

  return null
}

function extractChatPhoneJid(chat: Record<string, unknown>): string | null {
  const remoteJidAlt = chat.remoteJidAlt
  if (typeof remoteJidAlt === 'string' && remoteJidAlt.endsWith('@s.whatsapp.net')) return remoteJidAlt

  const phoneJid = chat.phoneJid
  if (typeof phoneJid === 'string' && phoneJid.endsWith('@s.whatsapp.net')) return phoneJid

  const key = chat.key
  if (key && typeof key === 'object' && !Array.isArray(key)) {
    const keyRemoteJidAlt = (key as Record<string, unknown>).remoteJidAlt
    if (typeof keyRemoteJidAlt === 'string' && keyRemoteJidAlt.endsWith('@s.whatsapp.net')) {
      return keyRemoteJidAlt
    }
  }

  return null
}

async function fetchWhatsappTagsFromApi(leads: ConversationLead[]): Promise<Map<string, ConversationTag[]>> {
  const baseUrl = getEvolutionBaseUrl()
  const apiKey = process.env.EVOLUTION_API_KEY ?? ''
  const instance = process.env.EVOLUTION_INSTANCE_NAME ?? ''
  if (!baseUrl || !apiKey || !instance || leads.length === 0) return new Map()

  const labels = await findLabels()
  if (labels.length === 0) return new Map()

  const lookups = buildLeadJidLookups(leads)
  const [crmTags, chatResponses] = await Promise.all([
    prisma.crmTag.findMany({ select: { id: true, name: true, color: true, waLabelId: true } }),
    Promise.all(labels.map(async (label) => {
      try {
        const response = await fetch(`${baseUrl}/chat/findChats/${instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: apiKey },
          body: JSON.stringify({ where: { labels: { array_contains: String(label.id) } }, take: 50 }),
        })
        if (!response.ok) return { labelId: String(label.id), chats: [] as Array<Record<string, unknown>> }
        return { labelId: String(label.id), chats: normalizeChatItems(await response.json()) }
      } catch {
        return { labelId: String(label.id), chats: [] as Array<Record<string, unknown>> }
      }
    })),
  ])

  const crmTagByLabelId = new Map(crmTags.filter((tag) => tag.waLabelId).map((tag) => [tag.waLabelId!, tag]))
  const whatsappLabelById = new Map(labels.map((label) => [
    String(label.id),
    { name: label.name, color: label.color } satisfies WhatsappLabelLookup,
  ]))
  const tagsByLeadId = new Map<string, ConversationTag[]>()

  for (const response of chatResponses) {
    for (const chat of response.chats) {
      const remoteJid = extractChatJid(chat)
      if (!remoteJid) continue

      const leadId = leadIdForWhatsappRow(
        { remoteJid, labels: [response.labelId], phoneJid: extractChatPhoneJid(chat) },
        lookups
      )
      if (!leadId) continue

      appendWhatsappTag(tagsByLeadId, {
        leadId,
        labelId: response.labelId,
        crmTagByLabelId,
        whatsappLabelById,
      })
    }
  }

  return tagsByLeadId
}

async function fetchWhatsappTags(leads: ConversationLead[]): Promise<Map<string, ConversationTag[]>> {
  const dbTags = await fetchWhatsappTagsFromDb(leads)
  if (dbTags.size > 0) return dbTags
  return fetchWhatsappTagsFromApi(leads)
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searchTerm = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  const phoneTerm = searchTerm.replace(/\D/g, '')

  const leads = await prisma.lead.findMany({
    where: searchTerm ? {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        ...(phoneTerm ? [{ phone: { contains: phoneTerm } }] : []),
        {
          messages: {
            some: {
              content: { contains: searchTerm, mode: 'insensitive' },
              NOT: { whatsappMessageId: { startsWith: 'note-' } },
            },
          },
        },
      ],
    } : undefined,
    orderBy: { updatedAt: 'desc' },
    take: MAX_CONVERSATIONS,
    select: {
      id: true,
      name: true,
      phone: true,
      waLid: true,
      profilePicUrl: true,
      updatedAt: true,
      lastReadAt: true,
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true } },
        },
      },
      messages: {
        where: { NOT: { whatsappMessageId: { startsWith: 'note-' } } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          content: true,
          direction: true,
          status: true,
          createdAt: true,
        },
      },
    },
  })

  const whatsappTagsByLeadId = await fetchWhatsappTags(leads)

  return NextResponse.json(leads.map((lead) => {
    const lastMessage = lead.messages[0] ?? null
    const isUnread = Boolean(
      lastMessage?.direction === 'INBOUND' &&
      (!lead.lastReadAt || lastMessage.createdAt > lead.lastReadAt)
    )

    const fallbackTags = whatsappTagsByLeadId.get(lead.id) ?? []
    const storedTagIds = new Set(lead.tags.map((entry) => entry.tagId))
    const tags = [
      ...lead.tags,
      ...fallbackTags.filter((entry) => !storedTagIds.has(entry.tagId)),
    ]

    return { ...lead, tags, lastMessage, isUnread, messages: undefined }
  }))
}
