/**
 * POST /api/crm/import/evolution
 * Importação idempotente de leads e etiquetas da Evolution API para o CRM.
 *
 * Fontes:
 *  - Evolution DB (EVOLUTION_DB_URL): Chat, Label, Message, Contact, Instance
 *  - CRM DB (DATABASE_URL via Prisma): Lead, CrmTag, LeadTag, LeadStage
 *
 * Idempotente: pode ser rodado N vezes sem duplicar registros.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Client } from 'pg'

const EVO_DB_URL  = process.env.EVOLUTION_DB_URL ?? ''
const INSTANCE    = process.env.EVOLUTION_INSTANCE_NAME ?? ''

// ── tipos internos ────────────────────────────────────────────────────────────

interface EvoChat {
  remoteJid: string
  name: string | null
  labels: string[] // array de labelId strings, ex: ["9", "15"]
}

interface EvoLabel {
  labelId: string
  name: string
  color: string | null
}

interface ChatLabelRow {
  remoteJid: string
  labelId: string
}

interface ImportReport {
  instance: string
  chats_found: number
  leads_created: number
  leads_updated: number
  leads_with_real_phone: number
  leads_with_synthetic_lid: number
  labels_found: number
  labels_created: number
  lead_labels_created: number
  errors: Array<{ context: string; error: string }>
}

// ── helpers Evolution DB ──────────────────────────────────────────────────────

async function getInstanceUuid(client: Client, name: string): Promise<string> {
  const res = await client.query<{ id: string }>(
    `SELECT id FROM "Instance" WHERE name = $1 LIMIT 1`,
    [name]
  )
  if (!res.rows[0]) throw new Error(`Instância "${name}" não encontrada na tabela Instance`)
  return res.rows[0].id
}

async function fetchAllChats(client: Client, instanceUuid: string): Promise<EvoChat[]> {
  const res = await client.query<{ remoteJid: string; name: string | null; labels: unknown }>(
    `SELECT "remoteJid", name, labels
     FROM "Chat"
     WHERE "instanceId" = $1
       AND "remoteJid" NOT LIKE '%@g.us'
       AND "remoteJid" NOT LIKE '%@newsletter'`,
    [instanceUuid]
  )
  return res.rows.map((r) => ({
    remoteJid: r.remoteJid,
    name: r.name ?? null,
    labels: parseLabelsArray(r.labels),
  }))
}

function parseLabelsArray(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch { /* ignore */ }
  }
  return []
}

async function fetchAllLabels(client: Client, instanceUuid: string): Promise<EvoLabel[]> {
  const res = await client.query<{ labelId: string; name: string; color: string | null }>(
    `SELECT "labelId", name, color FROM "Label" WHERE "instanceId" = $1`,
    [instanceUuid]
  )
  return res.rows
}

/** Retorna mapa lid → phone (sem @s.whatsapp.net) usando Message.key.remoteJidAlt */
async function buildLidToPhone(client: Client, instanceUuid: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  // Fonte 1: mensagens trocadas — key.remoteJid (@lid) → key.remoteJidAlt (@s.whatsapp.net)
  const msgRes = await client.query<{ lid: string; phone_jid: string }>(
    `SELECT DISTINCT
       key->>'remoteJid'    AS lid,
       key->>'remoteJidAlt' AS phone_jid
     FROM "Message"
     WHERE "instanceId" = $1
       AND key->>'remoteJid'    LIKE '%@lid'
       AND key->>'remoteJidAlt' LIKE '%@s.whatsapp.net'`,
    [instanceUuid]
  )
  for (const row of msgRes.rows) {
    if (row.lid && row.phone_jid) {
      map.set(row.lid, row.phone_jid.replace('@s.whatsapp.net', ''))
    }
  }

  // Fonte 2: IsOnWhatsapp (cache de verificação lid→phone, se existir)
  try {
    const iowRes = await client.query<{ phone_jid: string; lid: string }>(
      `SELECT "remoteJid" AS phone_jid, lid
       FROM "IsOnWhatsapp"
       WHERE lid IS NOT NULL AND lid LIKE '%@lid'`
    )
    for (const row of iowRes.rows) {
      if (row.lid && row.phone_jid && !map.has(row.lid)) {
        map.set(row.lid, row.phone_jid.replace('@s.whatsapp.net', ''))
      }
    }
  } catch { /* tabela pode não existir */ }

  return map
}

/** Retorna mapa lid → pushName via Contact.pushName */
async function buildLidToPushName(client: Client, instanceUuid: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const res = await client.query<{ remoteJid: string; pushName: string }>(
    `SELECT "remoteJid", "pushName"
     FROM "Contact"
     WHERE "instanceId" = $1 AND "pushName" IS NOT NULL`,
    [instanceUuid]
  )
  for (const row of res.rows) {
    if (row.remoteJid && row.pushName) map.set(row.remoteJid, row.pushName)
  }
  return map
}

/** Retorna todos os vínculos chat → labelId usando jsonb_array_elements_text */
async function fetchChatLabels(client: Client, instanceUuid: string): Promise<ChatLabelRow[]> {
  const res = await client.query<{ remoteJid: string; label_id: string }>(
    `SELECT c."remoteJid", label_id
     FROM "Chat" c,
          jsonb_array_elements_text(c.labels) AS label_id
     WHERE c."instanceId" = $1
       AND c."remoteJid" NOT LIKE '%@g.us'
       AND c."remoteJid" NOT LIKE '%@newsletter'
       AND c.labels IS NOT NULL
       AND c.labels != 'null'::jsonb
       AND jsonb_array_length(c.labels) > 0`,
    [instanceUuid]
  )
  return res.rows.map((r) => ({ remoteJid: r.remoteJid, labelId: r.label_id }))
}

// ── handler principal ─────────────────────────────────────────────────────────

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!EVO_DB_URL)  return NextResponse.json({ error: 'EVOLUTION_DB_URL não configurada' }, { status: 500 })
  if (!INSTANCE)    return NextResponse.json({ error: 'EVOLUTION_INSTANCE_NAME não configurada' }, { status: 500 })

  const report: ImportReport = {
    instance: INSTANCE,
    chats_found: 0,
    leads_created: 0,
    leads_updated: 0,
    leads_with_real_phone: 0,
    leads_with_synthetic_lid: 0,
    labels_found: 0,
    labels_created: 0,
    lead_labels_created: 0,
    errors: [],
  }

  const evoClient = new Client({ connectionString: EVO_DB_URL, ssl: { rejectUnauthorized: false } })

  try {
    await evoClient.connect()

    // ── 1. Resolver instanceId UUID ─────────────────────────────────────────
    const instanceUuid = await getInstanceUuid(evoClient, INSTANCE)

    // ── 2. Buscar dados do Evolution em paralelo ────────────────────────────
    const [chats, evoLabels, lidToPhone, lidToPushName, chatLabelRows] = await Promise.all([
      fetchAllChats(evoClient, instanceUuid),
      fetchAllLabels(evoClient, instanceUuid),
      buildLidToPhone(evoClient, instanceUuid),
      buildLidToPushName(evoClient, instanceUuid),
      fetchChatLabels(evoClient, instanceUuid),
    ])

    report.chats_found  = chats.length
    report.labels_found = evoLabels.length

    // ── 3. Importar labels → CrmTag ─────────────────────────────────────────
    // Map: labelId (string) → crmTagId (string)
    const labelIdToCrmTagId = new Map<string, string>()

    const existingTags = await prisma.crmTag.findMany({
      where: { waLabelId: { in: evoLabels.map((l) => l.labelId) } },
      select: { id: true, waLabelId: true },
    })
    for (const t of existingTags) {
      if (t.waLabelId) labelIdToCrmTagId.set(t.waLabelId, t.id)
    }

    for (const evoLabel of evoLabels) {
      if (labelIdToCrmTagId.has(evoLabel.labelId)) continue

      try {
        const tag = await prisma.crmTag.upsert({
          where:  { waLabelId: evoLabel.labelId },
          create: { name: evoLabel.name, color: evoLabel.color ?? '#8e8e93', waLabelId: evoLabel.labelId },
          update: { name: evoLabel.name, color: evoLabel.color ?? '#8e8e93' },
        })
        labelIdToCrmTagId.set(evoLabel.labelId, tag.id)
        report.labels_created++
      } catch (err) {
        report.errors.push({ context: `label ${evoLabel.labelId}`, error: String(err) })
      }
    }

    // ── 4. Stage padrão para novos leads ────────────────────────────────────
    const defaultStage = await prisma.leadStage.findFirst({ orderBy: { order: 'asc' } })
    if (!defaultStage) throw new Error('Nenhum LeadStage encontrado no CRM — crie pelo menos um.')

    // ── 5. Importar chats → Lead ─────────────────────────────────────────────
    // Agrupar chats: remoteJid → phone (resolvido ou null)
    type ChatImportEntry = { remoteJid: string; phone: string; name: string | null }
    const toImport: ChatImportEntry[] = []

    for (const chat of chats) {
      let phone: string | null = null

      if (chat.remoteJid.endsWith('@s.whatsapp.net')) {
        phone = chat.remoteJid.replace('@s.whatsapp.net', '')
      } else if (chat.remoteJid.endsWith('@lid')) {
        phone = lidToPhone.get(chat.remoteJid) ?? null
      }

      if (!phone || phone.length < 7) continue // tratado no bloco 5b

      const pushName = lidToPushName.get(chat.remoteJid) ?? chat.name ?? null
      toImport.push({ remoteJid: chat.remoteJid, phone, name: pushName })
      report.leads_with_real_phone++
    }

    // Buscar leads existentes por phone
    const phones = toImport.map((e) => e.phone)
    const existingLeads = await prisma.lead.findMany({
      where:  { phone: { in: phones } },
      select: { id: true, phone: true, waLid: true, name: true },
    })
    const existingByPhone = new Map(existingLeads.map((l) => [l.phone, l]))

    // waLid → leadId (para usar no vínculo de labels)
    const waLidToLeadId = new Map<string, string>()

    for (const entry of toImport) {
      const existing = existingByPhone.get(entry.phone)
      try {
        if (existing) {
          const updates: Record<string, string> = {}
          if (!existing.waLid) updates.waLid = entry.remoteJid
          if (!existing.name && entry.name) updates.name = entry.name
          if (Object.keys(updates).length > 0) {
            await prisma.lead.update({ where: { id: existing.id }, data: updates }).catch(() => {})
            report.leads_updated++
          }
          waLidToLeadId.set(entry.remoteJid, existing.id)
        } else {
          const lead = await prisma.lead.create({
            data: {
              phone:   entry.phone,
              waLid:   entry.remoteJid,
              name:    entry.name,
              stageId: defaultStage.id,
            },
          })
          waLidToLeadId.set(entry.remoteJid, lead.id)
          report.leads_created++
        }
      } catch (err) {
        report.errors.push({ context: `lead phone=${entry.phone}`, error: String(err) })
      }
    }

    // ── 5b. Leads com @lid não resolvido → phone sintético "lid:NUMBER" ─────
    // Garante que TODOS os 3840 contatos entrem no CRM com waLid correto.
    // Quando o contato enviar mensagem, o webhook atualiza para o telefone real.
    for (const chat of chats) {
      if (!chat.remoteJid.endsWith('@lid')) continue

      // Já foi resolvido no passo anterior
      if (waLidToLeadId.has(chat.remoteJid)) continue

      const lidNumber    = chat.remoteJid.replace('@lid', '')
      const syntheticPhone = `lid:${lidNumber}`
      const pushName     = lidToPushName.get(chat.remoteJid) ?? chat.name ?? null

      try {
        // Verificar se já existe por waLid (importação anterior)
        const existingByWaLid = await prisma.lead.findUnique({
          where: { waLid: chat.remoteJid },
          select: { id: true },
        })
        if (existingByWaLid) {
          waLidToLeadId.set(chat.remoteJid, existingByWaLid.id)
          continue
        }

        // Verificar se já existe pelo phone sintético
        const existingBySynth = await prisma.lead.findUnique({
          where: { phone: syntheticPhone },
          select: { id: true },
        })
        if (existingBySynth) {
          // Garantir que waLid esteja correto
          await prisma.lead.update({
            where: { id: existingBySynth.id },
            data: { waLid: chat.remoteJid },
          }).catch(() => {})
          waLidToLeadId.set(chat.remoteJid, existingBySynth.id)
          report.leads_updated++
          continue
        }

        const lead = await prisma.lead.create({
          data: {
            phone:   syntheticPhone,
            waLid:   chat.remoteJid,
            name:    pushName,
            stageId: defaultStage.id,
          },
        })
        waLidToLeadId.set(chat.remoteJid, lead.id)
        report.leads_created++
        report.leads_with_synthetic_lid++
      } catch (err) {
        report.errors.push({ context: `lid-lead ${chat.remoteJid}`, error: String(err) })
      }
    }

    // ── 6. Importar vínculos lead ↔ label → LeadTag ─────────────────────────
    const leadLabelPairs: Array<{ leadId: string; tagId: string }> = []

    for (const row of chatLabelRows) {
      const leadId = waLidToLeadId.get(row.remoteJid)
      const tagId  = labelIdToCrmTagId.get(row.labelId)
      if (leadId && tagId) leadLabelPairs.push({ leadId, tagId })
    }

    if (leadLabelPairs.length > 0) {
      // createMany com skipDuplicates garante idempotência
      const res = await prisma.leadTag.createMany({
        data:           leadLabelPairs,
        skipDuplicates: true,
      })
      report.lead_labels_created = res.count
    }

    return NextResponse.json(report)

  } catch (err) {
    console.error('[evolution-import]', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ...report, fatal_error: msg }, { status: 500 })
  } finally {
    await evoClient.end().catch(() => {})
  }
}
