// Resolve etiquetas de leads a partir das labels nativas do WhatsApp Business
// (armazenadas na instância da Evolution API), cruzando com CrmTag.waLabelId
// quando existe uma etiqueta do CRM mapeada pra aquela label.
//
// Usado tanto pela lista de conversas (src/app/api/crm/conversations/route.ts,
// resolução em lote e só de leitura) quanto pelo painel de um lead específico
// (src/app/api/crm/leads/[id]/route.ts, que também grava o resultado como
// LeadTag real — ver hydrateLeadTags — pra lista e painel nunca divergirem).
import { findLabels } from '@/lib/evolution-client'
import { prisma } from '@/lib/prisma'
import { LABEL_ID_TO_NAME, WA_COLORS } from '@/lib/wa-label-map'
import { getEvolutionBaseUrl } from '@/lib/evolution-url'

export type WaTagLead = {
  id: string
  phone: string
  waLid: string | null
  tags: Array<{ tagId: string }>
}

export type WaResolvedTag = {
  leadId: string
  tagId: string
  tag: { id: string; name: string; color: string }
}

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

function addUnique<T>(items: T[], item: T) {
  if (!items.includes(item)) items.push(item)
}

function phoneDigitsFromJid(jid: string | null): string {
  if (!jid?.endsWith('@s.whatsapp.net')) return ''
  return jid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
}

function phoneLookupKeys(value: string | null): string[] {
  const digits = value?.replace(/\D/g, '') ?? ''
  if (!digits) return []

  const keys: string[] = []
  addUnique(keys, digits)

  const withoutBrazilCode = digits.startsWith('55') ? digits.slice(2) : digits
  if (withoutBrazilCode) {
    addUnique(keys, withoutBrazilCode)
    addUnique(keys, `55${withoutBrazilCode}`)
  }

  if (withoutBrazilCode.length === 11) {
    const areaCode = withoutBrazilCode.slice(0, 2)
    const subscriber = withoutBrazilCode.slice(2)
    if (subscriber.startsWith('9')) {
      const withoutNinthDigit = `${areaCode}${subscriber.slice(1)}`
      addUnique(keys, withoutNinthDigit)
      addUnique(keys, `55${withoutNinthDigit}`)
    }
  }

  if (withoutBrazilCode.length === 10) {
    const withNinthDigit = `${withoutBrazilCode.slice(0, 2)}9${withoutBrazilCode.slice(2)}`
    addUnique(keys, withNinthDigit)
    addUnique(keys, `55${withNinthDigit}`)
  }

  return keys
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

function buildLeadJidLookups(leads: WaTagLead[]) {
  const jidToLeadId = new Map<string, string>()
  const phoneJidToLeadId = new Map<string, string>()
  const phoneKeyToLeadId = new Map<string, string>()
  for (const lead of leads) {
    if (!lead.phone.startsWith('lid:')) {
      const phoneJid = `${lead.phone}@s.whatsapp.net`
      jidToLeadId.set(phoneJid, lead.id)
      phoneJidToLeadId.set(phoneJid, lead.id)
      for (const key of phoneLookupKeys(lead.phone)) {
        if (!phoneKeyToLeadId.has(key)) phoneKeyToLeadId.set(key, lead.id)
      }
    }
    if (lead.waLid) jidToLeadId.set(lead.waLid, lead.id)
  }
  return { jidToLeadId, phoneJidToLeadId, phoneKeyToLeadId }
}

function appendWhatsappTag(
  tagsByLeadId: Map<string, WaResolvedTag[]>,
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
  const exactLeadId = lookups.jidToLeadId.get(row.remoteJid) ?? (
    row.phoneJid ? lookups.phoneJidToLeadId.get(row.phoneJid) : undefined
  )
  if (exactLeadId) return exactLeadId

  for (const key of [
    ...phoneLookupKeys(phoneDigitsFromJid(row.remoteJid)),
    ...phoneLookupKeys(phoneDigitsFromJid(row.phoneJid)),
  ]) {
    const leadId = lookups.phoneKeyToLeadId.get(key)
    if (leadId) return leadId
  }

  return undefined
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

async function fetchWhatsappTagsFromDb(leads: WaTagLead[]): Promise<Map<string, WaResolvedTag[]>> {
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
    const tagsByLeadId = new Map<string, WaResolvedTag[]>()

    for (const row of rows) {
      const leadId = leadIdForWhatsappRow(row, lookups)
      if (!leadId) continue

      for (const labelId of parseLabelIds(row.labels)) {
        appendWhatsappTag(tagsByLeadId, { leadId, labelId, crmTagByLabelId, whatsappLabelById })
      }
    }

    return tagsByLeadId
  } catch (error) {
    console.error('[wa-tags] Erro ao buscar etiquetas da Evolution:', error)
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

async function fetchWhatsappTagsFromApi(leads: WaTagLead[]): Promise<Map<string, WaResolvedTag[]>> {
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
  const tagsByLeadId = new Map<string, WaResolvedTag[]>()

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

/** Resolve, sem gravar nada, as etiquetas de WhatsApp de um lote de leads —
 *  tenta primeiro direto no banco da Evolution (mais rápido/completo) e cai
 *  pra API só pros leads que não deram match. */
export async function fetchWhatsappTags(leads: WaTagLead[]): Promise<Map<string, WaResolvedTag[]>> {
  const dbTags = await fetchWhatsappTagsFromDb(leads)
  const leadsWithoutDbTags = leads.filter((lead) => !dbTags.has(lead.id))
  if (leadsWithoutDbTags.length === 0) return dbTags

  const apiTags = await fetchWhatsappTagsFromApi(leadsWithoutDbTags)
  for (const [leadId, tags] of apiTags) {
    const currentTags = dbTags.get(leadId) ?? []
    const currentTagIds = new Set(currentTags.map((entry) => entry.tagId))
    dbTags.set(leadId, [
      ...currentTags,
      ...tags.filter((entry) => !currentTagIds.has(entry.tagId)),
    ])
  }
  return dbTags
}

/**
 * Resolve as etiquetas de WhatsApp de UM lead e grava como LeadTag real
 * (criando o CrmTag correspondente se ainda não existir) — assim o painel
 * do lead (que só lê LeadTag) para de divergir da lista de conversas (que
 * já mostrava a etiqueta via fetchWhatsappTags, mas sem persistir). Idempotente:
 * se já tiver essa etiqueta gravada, não faz nada.
 */
export async function hydrateLeadTags(lead: WaTagLead): Promise<boolean> {
  const resolved = await fetchWhatsappTags([lead])
  const fallbackTags = resolved.get(lead.id) ?? []
  const existingTagIds = new Set(lead.tags.map((entry) => entry.tagId))
  const newTags = fallbackTags.filter((entry) => !existingTagIds.has(entry.tagId))
  if (newTags.length === 0) return false

  for (const entry of newTags) {
    let tagId = entry.tagId
    if (tagId.startsWith('wa:')) {
      const labelId = tagId.slice(3)
      const crmTag = await prisma.crmTag.upsert({
        where: { waLabelId: labelId },
        create: { name: entry.tag.name, color: entry.tag.color, waLabelId: labelId },
        update: {},
      })
      tagId = crmTag.id
    }
    await prisma.leadTag.upsert({
      where: { leadId_tagId: { leadId: lead.id, tagId } },
      create: { leadId: lead.id, tagId },
      update: {},
    })
  }

  return true
}
