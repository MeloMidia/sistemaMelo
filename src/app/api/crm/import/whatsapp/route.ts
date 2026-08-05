import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findLabels } from '@/lib/evolution-client'
import { WA_COLORS, STAGE_PRIORITY, LABEL_TO_STAGE, LABEL_ID_TO_STAGE, LABEL_ID_TO_NAME } from '@/lib/wa-label-map'

// Aumenta o timeout da Vercel para esta rota
export const maxDuration = 60

const BASE_URL = (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '')
const API_KEY = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

async function evo(path: string, init?: RequestInit) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', apikey: API_KEY, ...(init?.headers ?? {}) },
  })
}

async function fetchAllChats(): Promise<unknown[]> {
  const all: unknown[] = []
  const PAGE = 500
  for (let page = 0; page < 20; page++) {
    const res = await evo(`/chat/findChats/${INSTANCE}`, {
      method: 'POST',
      body: JSON.stringify({ count: PAGE, pageIndex: page }),
    })
    if (!res.ok) break
    const data = await res.json()
    const items: unknown[] = Array.isArray(data)
      ? data
      : ((data as Record<string, unknown>)?.chats as unknown[] ?? [])
    all.push(...items)
    if (items.length < PAGE) break
  }
  return all
}

/**
 * Busca mapeamento labelId → [jids] DIRETO do banco PostgreSQL da Evolution API.
 *
 * A REST API da Evolution usa prisma.$queryRaw() com array_contains que precisa
 * de arquivos temporários de ordenação. Com o disco cheio (erro 53100 "No space
 * left on device") qualquer take > 5 falha. Consultar o banco diretamente evita
 * esse problema pois é um SELECT simples sem ORDER BY (sem temp files).
 */
async function fetchLabelJidsFromDb(): Promise<Map<string, string[]>> {
  const dbUrl = process.env.EVOLUTION_DB_URL
  if (!dbUrl) {
    console.warn('[WA Import] EVOLUTION_DB_URL não configurada — etiquetas não serão sincronizadas')
    return new Map()
  }

  const { Client } = await import('pg')
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()

    // SELECT simples sem ORDER BY → não usa temp disk, seguro mesmo com disco cheio
    const result = await client.query<{ remoteJid: string; labels: unknown }>(
      `SELECT "remoteJid", labels
       FROM "Chat"
       WHERE labels IS NOT NULL
         AND labels::text != 'null'
         AND labels::text != '[]'
         AND "remoteJid" NOT LIKE '%@g.us'
         AND "remoteJid" NOT LIKE '%@newsletter'
       LIMIT 50000`
    )

    const map = new Map<string, string[]>()

    for (const row of result.rows) {
      const jid = row.remoteJid
      if (!jid) continue

      // labels pode ser parsed automaticamente pelo pg driver (JSONB) ou string
      let rawLabels = row.labels
      if (typeof rawLabels === 'string') {
        try { rawLabels = JSON.parse(rawLabels) } catch { continue }
      }
      if (!Array.isArray(rawLabels)) continue

      for (const entry of rawLabels) {
        let labelId: string
        if (typeof entry === 'string') labelId = entry
        else if (typeof entry === 'number') labelId = String(entry)
        else if (entry && typeof entry === 'object' && 'id' in (entry as object))
          labelId = String((entry as Record<string, unknown>).id)
        else continue

        if (!labelId) continue
        if (!map.has(labelId)) map.set(labelId, [])
        map.get(labelId)!.push(jid)
      }
    }

    console.log(`[WA Import] DB direto: ${result.rows.length} chats com labels, ${map.size} labelIds distintos`)
    return map
  } catch (err) {
    console.error('[WA Import] Erro ao consultar DB direto da Evolution:', err)
    return new Map()
  } finally {
    await client.end().catch(() => {})
  }
}

async function updateWebhook(existingUrl: string, existingEvents: string[]) {
  const events = [...new Set([...existingEvents, 'LABELS_ASSOCIATION'])]
  const res = await evo(`/webhook/set/${INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({ url: existingUrl, events, webhookByEvents: false, webhookBase64: false, enabled: true }),
  })
  return res.ok
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    return await runImport()
  } catch (err) {
    console.error('[WA Import] erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

async function runImport() {
  // ── Fase 1: Buscar dados em paralelo ─────────────────────────────────────
  const [waLabels, chats, dbStages, existingTags] = await Promise.all([
    findLabels(),
    fetchAllChats(),
    prisma.leadStage.findMany({ orderBy: { order: 'asc' } }),
    prisma.crmTag.findMany(),
  ])

  const stageByName = new Map(dbStages.map((s) => [s.name, s]))
  const defaultStage = dbStages[0]

  // Criar stage "Perdido" se não existir
  if (!stageByName.has('Perdido')) {
    const lastOrder = Math.max(...dbStages.map((s) => s.order))
    const perdido = await prisma.leadStage.create({
      data: { name: 'Perdido', color: '#ef4444', order: lastOrder + 1000 },
    })
    stageByName.set('Perdido', perdido)
  }

  // ── Fase 2: Sincronizar CrmTags com os labels do WhatsApp ────────────────
  const tagByName = new Map(existingTags.map((t) => [t.name, t]))
  for (const l of waLabels) {
    if (!tagByName.has(l.name)) {
      const color =
        typeof l.color === 'number' ? (WA_COLORS[l.color] ?? '#8e8e93')
        : typeof l.color === 'string' ? l.color
        : '#8e8e93'
      const tag = await prisma.crmTag.upsert({
        where: { waLabelId: String(l.id) },
        create: { name: l.name, color, waLabelId: String(l.id) },
        update: { name: l.name, color },
      })
      tagByName.set(tag.name, tag)
    }
  }
  for (const label of waLabels) {
    const tag = tagByName.get(label.name)
    if (tag && !tag.waLabelId) {
      await prisma.crmTag.update({ where: { id: tag.id }, data: { waLabelId: String(label.id) } })
    }
  }
  // Corrigir nomes garbled (encoding da Evolution API)
  const allTagsForFix = await prisma.crmTag.findMany({
    where: { waLabelId: { not: null } },
    select: { id: true, waLabelId: true, name: true },
  })
  for (const tag of allTagsForFix) {
    const canonical = LABEL_ID_TO_NAME[tag.waLabelId!]
    if (canonical && tag.name !== canonical) {
      await prisma.crmTag.update({ where: { id: tag.id }, data: { name: canonical } })
    }
  }

  // ── Fase 3: Extrair contatos dos chats ──────────────────────────────────
  // Nota: a Evolution API NÃO inclui o campo `labels` nos objetos de chat.
  // O mapeamento label→jids é feito na Fase 5 via fetchChatsForLabel (filtro confirmado).

  type ChatEntry = { phone: string; waLid: string; name: string | null }
  const toImport = new Map<string, ChatEntry>()

  for (const raw of chats) {
    const chat = raw as Record<string, unknown>
    const jid = String(chat.remoteJid ?? chat.id ?? '')
    if (!jid || jid.endsWith('@g.us') || jid.endsWith('@newsletter')) continue

    let phone: string | null = null
    if (jid.endsWith('@s.whatsapp.net')) {
      phone = jid.split('@')[0]
    } else if (jid.endsWith('@lid')) {
      const lastMsg = chat.lastMessage as Record<string, unknown> | undefined
      const key = lastMsg?.key as Record<string, unknown> | undefined
      const alt = key?.remoteJidAlt as string | undefined
      if (alt?.endsWith('@s.whatsapp.net')) phone = alt.split('@')[0]
    }
    if (!phone || phone.length < 8) continue
    toImport.set(phone, {
      phone,
      waLid: jid,
      name: typeof chat.pushName === 'string' ? chat.pushName : null,
    })
  }

  // ── Fase 4: Criar/atualizar leads ────────────────────────────────────────
  const phones = [...toImport.keys()]
  const existingLeads = await prisma.lead.findMany({
    where: { phone: { in: phones } },
    select: { id: true, phone: true, waLid: true },
  })
  const existingByPhone = new Map(existingLeads.map((l) => [l.phone, l]))

  const newLeads = phones
    .filter((p) => !existingByPhone.has(p))
    .map((p) => {
      const e = toImport.get(p)!
      return { phone: p, name: e.name, waLid: e.waLid, stageId: defaultStage.id }
    })

  if (newLeads.length > 0) {
    await prisma.lead.createMany({ data: newLeads, skipDuplicates: true })
  }

  // Preencher waLid em leads existentes que não têm
  for (const existing of existingLeads) {
    if (!existing.waLid) {
      const entry = toImport.get(existing.phone)
      if (entry) {
        await prisma.lead.update({ where: { id: existing.id }, data: { waLid: entry.waLid } }).catch(() => {})
      }
    }
  }

  // ── Fase 5: Mapear label → jids via DB direto e aplicar tags/stages ──────
  const freshTags = await prisma.crmTag.findMany()
  const tagById = new Map(freshTags.map((t) => [t.waLabelId ?? '', t]))
  const allStages = await prisma.leadStage.findMany({ select: { id: true, name: true } })
  const stageByIdFresh = new Map(allStages.map((s) => [s.id, s]))

  // Consulta o banco da Evolution diretamente para evitar erro de disco cheio
  // (a REST API falha com "No space left on device" para take > 5)
  const labelToJids = await fetchLabelJidsFromDb()

  // Limpa vínculos WA antigos apenas se encontramos dados de alguma etiqueta
  const waTagIds = freshTags.filter(t => t.waLabelId).map(t => t.id)
  if (labelToJids.size > 0 && waTagIds.length > 0) {
    await prisma.leadTag.deleteMany({ where: { tagId: { in: waTagIds } } })
  }

  let stagesAssigned = 0
  let tagsApplied = 0

  for (const label of waLabels) {
    const labelId = String(label.id)
    const jids = labelToJids.get(labelId) ?? []
    if (jids.length === 0) continue

    const stageName = LABEL_ID_TO_STAGE[labelId]
    const targetStage = stageName
      ? stageByName.get(stageName) ?? allStages.find(s => s.name === stageName)
      : null
    const crmTag = tagById.get(labelId) ?? null

    const leads = await prisma.lead.findMany({
      where: { waLid: { in: jids } },
      select: { id: true, stageId: true },
    })
    if (leads.length === 0) continue

    await Promise.all([
      (async () => {
        if (!targetStage) return
        const newPriority = STAGE_PRIORITY[stageName!] ?? 0
        const toUpdate = leads
          .filter(l => (STAGE_PRIORITY[stageByIdFresh.get(l.stageId)?.name ?? ''] ?? 0) < newPriority)
          .map(l => l.id)
        if (toUpdate.length === 0) return
        await prisma.lead.updateMany({ where: { id: { in: toUpdate } }, data: { stageId: targetStage.id } })
        stagesAssigned += toUpdate.length
      })(),
      (async () => {
        if (!crmTag) return
        await prisma.leadTag.createMany({
          data: leads.map(l => ({ leadId: l.id, tagId: crmTag.id })),
          skipDuplicates: true,
        })
        tagsApplied += leads.length
      })(),
    ])
  }

  // ── Fase 6: Atualizar webhook ────────────────────────────────────────────
  let webhookUpdated = false
  const webhookRes = await evo(`/webhook/find/${INSTANCE}`, { method: 'GET' })
  if (webhookRes.ok) {
    const wh = await webhookRes.json() as Record<string, unknown>
    const url = String(wh.url ?? '')
    const events = Array.isArray(wh.events) ? wh.events as string[] : []
    webhookUpdated = await updateWebhook(url, events)
  }

  return NextResponse.json({
    chatsImported: newLeads.length,
    chatsAlreadyExisted: existingLeads.length,
    totalChats: phones.length,
    stagesAssigned,
    tagsApplied,
    webhookUpdated,
    labels: waLabels.length,
    labelsWithChats: labelToJids.size,
  })
}

export { LABEL_TO_STAGE, STAGE_PRIORITY }
