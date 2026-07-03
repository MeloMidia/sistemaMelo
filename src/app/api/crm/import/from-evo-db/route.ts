import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Client } from 'pg'
import { LABEL_ID_TO_STAGE, STAGE_PRIORITY } from '@/lib/wa-label-map'

const EVO_DB_URL = process.env.EVOLUTION_DB_URL ?? ''

function parseLabelIds(labels: unknown): string[] {
  if (Array.isArray(labels)) return labels.map((l: unknown) => String(l))
  if (typeof labels === 'string') {
    try { return (JSON.parse(labels) as unknown[]).map((l) => String(l)) } catch { return [] }
  }
  return []
}

function extractPhone(jid: string): string | null {
  if (jid.endsWith('@s.whatsapp.net')) return jid.replace('@s.whatsapp.net', '')
  return null
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!EVO_DB_URL) return NextResponse.json({ error: 'EVOLUTION_DB_URL não configurada' }, { status: 500 })

  const client = new Client({ connectionString: EVO_DB_URL, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()

    // ── Step 1: Reset bad data from previous import ───────────────────────
    const waTags = await prisma.crmTag.findMany({ where: { waLabelId: { not: null } }, select: { id: true } })
    const waTagIds = waTags.map((t) => t.id)
    if (waTagIds.length > 0) await prisma.leadTag.deleteMany({ where: { tagId: { in: waTagIds } } })
    const firstStage = await prisma.leadStage.findFirst({ orderBy: { order: 'asc' } })
    if (!firstStage) throw new Error('Nenhum stage encontrado')
    await prisma.lead.updateMany({ data: { stageId: firstStage.id } })

    // ── Step 2: Get all labeled chats from Evolution DB ───────────────────
    const chatsResult = await client.query<{ remoteJid: string; labels: unknown; name: string | null }>(
      `SELECT "remoteJid", labels, name FROM "Chat"
       WHERE labels IS NOT NULL AND labels::text != '[]' AND labels::text != 'null'`
    )

    // ── Step 3: Build LID → phone map from Message table ─────────────────
    // Messages store remoteJidAlt (the real @s.whatsapp.net JID) for LID contacts
    const lidRows = chatsResult.rows.filter((r) => r.remoteJid.endsWith('@lid'))
    const lidSet = lidRows.map((r) => r.remoteJid)

    const lidToPhone = new Map<string, string>()

    if (lidSet.length > 0) {
      // Get ALL LID→phone mappings from Message table in one query (no filter by specific LIDs)
      // remoteJidAlt is present on messages sent by Baileys (fromMe=true) for LID contacts
      const lidPhones = await client.query<{ lid: string; alt: string }>(
        `SELECT DISTINCT key->>'remoteJid' as lid, key->>'remoteJidAlt' as alt
         FROM "Message"
         WHERE key->>'remoteJid' LIKE '%@lid'
           AND key->>'remoteJidAlt' LIKE '%@s.whatsapp.net'`
      )
      for (const row of lidPhones.rows) {
        if (row.lid && row.alt) lidToPhone.set(row.lid, row.alt.replace('@s.whatsapp.net', ''))
      }
    }

    // ── Step 4: Load/create CRM data ──────────────────────────────────────
    const allStages = await prisma.leadStage.findMany({ select: { id: true, name: true } })
    const stageByName = new Map(allStages.map((s) => [s.name, s]))
    const stageById = new Map(allStages.map((s) => [s.id, s]))
    const crmTags = await prisma.crmTag.findMany({ where: { waLabelId: { not: null } }, select: { id: true, waLabelId: true } })
    const tagByLabelId = new Map(crmTags.map((t) => [t.waLabelId!, t]))

    // ── Step 5: Import missing leads ──────────────────────────────────────
    // Build phone→{waLid, name} for all labeled chats we can resolve
    const toImport = new Map<string, { waLid: string; name: string | null }>()
    for (const row of chatsResult.rows) {
      let phone: string | null = null
      if (row.remoteJid.endsWith('@s.whatsapp.net')) {
        phone = extractPhone(row.remoteJid)
      } else if (row.remoteJid.endsWith('@lid')) {
        phone = lidToPhone.get(row.remoteJid) ?? null
      }
      if (!phone || phone.length < 8) continue
      if (!toImport.has(phone)) toImport.set(phone, { waLid: row.remoteJid, name: row.name ?? null })
    }

    const phones = [...toImport.keys()]
    const existingLeads = await prisma.lead.findMany({
      where: { phone: { in: phones } },
      select: { id: true, phone: true, waLid: true, stageId: true },
    })
    const existingByPhone = new Map(existingLeads.map((l) => [l.phone, l]))

    // Update waLid on existing leads to match Evolution DB's remoteJid (source of truth)
    for (const lead of existingLeads) {
      const entry = toImport.get(lead.phone)
      if (entry && lead.waLid !== entry.waLid) {
        await prisma.lead.update({ where: { id: lead.id }, data: { waLid: entry.waLid } }).catch(() => {})
      }
    }

    // Create new leads (contacts with labels not yet in CRM)
    const newLeadData = phones
      .filter((p) => !existingByPhone.has(p))
      .map((p) => ({ phone: p, name: toImport.get(p)!.name, waLid: toImport.get(p)!.waLid, stageId: firstStage.id }))

    if (newLeadData.length > 0) {
      await prisma.lead.createMany({ data: newLeadData, skipDuplicates: true })
    }

    // ── Step 6: Apply stages and tags ─────────────────────────────────────
    // Reload all leads with waLid (includes newly created ones)
    const allLeads = await prisma.lead.findMany({
      where: { waLid: { not: null } },
      select: { id: true, stageId: true, waLid: true },
    })
    const leadByWaLid = new Map(allLeads.map((l) => [l.waLid!, l]))

    const leadUpdates = new Map<string, { stageId: string; tagIds: Set<string> }>()

    for (const row of chatsResult.rows) {
      const lead = leadByWaLid.get(row.remoteJid)
      if (!lead) continue

      const labelIds = parseLabelIds(row.labels)
      if (labelIds.length === 0) continue

      if (!leadUpdates.has(lead.id)) {
        leadUpdates.set(lead.id, { stageId: lead.stageId, tagIds: new Set() })
      }
      const update = leadUpdates.get(lead.id)!

      for (const labelId of labelIds) {
        const stageName = LABEL_ID_TO_STAGE[labelId]
        if (stageName) {
          const targetStage = stageByName.get(stageName)
          if (targetStage) {
            const currentPriority = STAGE_PRIORITY[stageById.get(update.stageId)?.name ?? ''] ?? 0
            const newPriority = STAGE_PRIORITY[stageName] ?? 0
            if (newPriority > currentPriority) update.stageId = targetStage.id
          }
        }
        const tag = tagByLabelId.get(labelId)
        if (tag) update.tagIds.add(tag.id)
      }
    }

    // Batch stage updates
    const byStage = new Map<string, string[]>()
    for (const [leadId, update] of leadUpdates) {
      if (!byStage.has(update.stageId)) byStage.set(update.stageId, [])
      byStage.get(update.stageId)!.push(leadId)
    }
    let stagesAssigned = 0
    for (const [stageId, leadIds] of byStage) {
      if (stageId === firstStage.id) continue
      await prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: { stageId } })
      stagesAssigned += leadIds.length
    }

    // Batch tag inserts
    const tagRows: { leadId: string; tagId: string }[] = []
    for (const [leadId, update] of leadUpdates) {
      for (const tagId of update.tagIds) tagRows.push({ leadId, tagId })
    }
    if (tagRows.length > 0) await prisma.leadTag.createMany({ data: tagRows, skipDuplicates: true })

    return NextResponse.json({
      chatsWithLabels: chatsResult.rows.length,
      leadsCreated: newLeadData.length,
      leadsAlreadyExisted: existingLeads.length,
      stagesAssigned,
      tagsApplied: tagRows.length,
    })
  } catch (err) {
    console.error('[from-evo-db]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  } finally {
    await client.end().catch(() => {})
  }
}
