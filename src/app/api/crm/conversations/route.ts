import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LABEL_ID_TO_NAME, WA_COLORS } from '@/lib/wa-label-map'

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
      return ''
    })
    .filter(Boolean)
}

function labelColor(value: string | number | undefined): string {
  if (typeof value === 'number') return WA_COLORS[value] ?? '#64748b'
  return value || '#64748b'
}

async function fetchWhatsappTags(leads: ConversationLead[]): Promise<Map<string, ConversationTag[]>> {
  const dbUrl = process.env.EVOLUTION_DB_URL
  if (!dbUrl || leads.length === 0) return new Map()

  const jidToLeadId = new Map<string, string>()
  for (const lead of leads) {
    jidToLeadId.set(`${lead.phone}@s.whatsapp.net`, lead.id)
    if (lead.waLid) jidToLeadId.set(lead.waLid, lead.id)
  }

  const { Client } = await import('pg')
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()
    const [rows, crmTags] = await Promise.all([
      client.query<{ remoteJid: string; labels: unknown }>(
        `SELECT "remoteJid", labels
         FROM "Chat"
         WHERE "remoteJid" = ANY($1::text[])
           AND labels IS NOT NULL
           AND labels::text != 'null'
           AND labels::text != '[]'`,
        [[...jidToLeadId.keys()]]
      ),
      prisma.crmTag.findMany({ select: { id: true, name: true, color: true, waLabelId: true } }),
    ])

    let whatsappLabels: Array<{ labelId: string; name: string; color: string | number | null }> = []
    try {
      const labelRows = await client.query<{ labelId: string; name: string; color: string | number | null }>(
        `SELECT "labelId", name, color FROM "Label"`
      )
      whatsappLabels = labelRows.rows
    } catch {
      whatsappLabels = []
    }

    const whatsappLabelById = new Map(whatsappLabels.map((label) => [String(label.labelId), label]))
    const crmTagByLabelId = new Map(crmTags.filter((tag) => tag.waLabelId).map((tag) => [tag.waLabelId!, tag]))
    const tagsByLeadId = new Map<string, ConversationTag[]>()

    for (const row of rows.rows) {
      const leadId = jidToLeadId.get(row.remoteJid)
      if (!leadId) continue

      const tags = tagsByLeadId.get(leadId) ?? []
      const seenTagIds = new Set(tags.map((entry) => entry.tagId))

      for (const labelId of parseLabelIds(row.labels)) {
        if (seenTagIds.has(labelId)) continue

        const crmTag = crmTagByLabelId.get(labelId)
        const whatsappLabel = whatsappLabelById.get(labelId)
        const tag = crmTag
          ? { id: crmTag.id, name: crmTag.name, color: crmTag.color }
          : {
              id: `wa:${labelId}`,
              name: LABEL_ID_TO_NAME[labelId] ?? whatsappLabel?.name ?? `Etiqueta ${labelId}`,
              color: labelColor(whatsappLabel?.color ?? undefined),
            }

        tags.push({ leadId, tagId: tag.id, tag })
        seenTagIds.add(labelId)
      }

      if (tags.length > 0) tagsByLeadId.set(leadId, tags)
    }

    return tagsByLeadId
  } catch (error) {
    console.error('[crm/conversations] Erro ao buscar etiquetas da Evolution:', error)
    return new Map()
  } finally {
    await client.end().catch(() => {})
  }
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
