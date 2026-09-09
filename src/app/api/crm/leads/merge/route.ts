import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const mergeLeadSelect = {
  id: true,
  phone: true,
  name: true,
  waLid: true,
  stageId: true,
  assignedToId: true,
  value: true,
  temperature: true,
  notes: true,
  cpf: true,
  email: true,
  city: true,
  state: true,
  neighborhood: true,
  postalCode: true,
  address: true,
  instagram: true,
  nickname: true,
  mercadoLivreStatus: true,
  businessArea: true,
  companyName: true,
  mlKnowledge: true,
  stock: true,
  revenue: true,
  employees: true,
  partners: true,
  profilePicUrl: true,
  followUpColumn: true,
  followUpMovedAt: true,
  closedAt: true,
  lastReadAt: true,
  stageEnteredAt: true,
} as const

type MergeLead = Prisma.Result<typeof prisma.lead, { select: typeof mergeLeadSelect }, 'findUnique'>

function isUsable(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined
}

function prefer<T>(primary: T, duplicate: T) {
  return isUsable(primary) ? primary : duplicate
}

function latestDate(primary: Date | null, duplicate: Date | null) {
  if (!primary) return duplicate
  if (!duplicate) return primary
  return primary > duplicate ? primary : duplicate
}

function mergeLeadFields(primary: NonNullable<MergeLead>, duplicate: NonNullable<MergeLead>) {
  const merged = {
    name: prefer(primary.name, duplicate.name),
    waLid: prefer(primary.waLid, duplicate.waLid),
    stageId: prefer(primary.stageId, duplicate.stageId),
    assignedToId: prefer(primary.assignedToId, duplicate.assignedToId),
    value: prefer(primary.value, duplicate.value),
    temperature: prefer(primary.temperature, duplicate.temperature),
    notes: prefer(primary.notes, duplicate.notes),
    cpf: prefer(primary.cpf, duplicate.cpf),
    email: prefer(primary.email, duplicate.email),
    city: prefer(primary.city, duplicate.city),
    state: prefer(primary.state, duplicate.state),
    neighborhood: prefer(primary.neighborhood, duplicate.neighborhood),
    postalCode: prefer(primary.postalCode, duplicate.postalCode),
    address: prefer(primary.address, duplicate.address),
    instagram: prefer(primary.instagram, duplicate.instagram),
    nickname: prefer(primary.nickname, duplicate.nickname),
    mercadoLivreStatus: prefer(primary.mercadoLivreStatus, duplicate.mercadoLivreStatus),
    businessArea: prefer(primary.businessArea, duplicate.businessArea),
    companyName: prefer(primary.companyName, duplicate.companyName),
    mlKnowledge: prefer(primary.mlKnowledge, duplicate.mlKnowledge),
    stock: prefer(primary.stock, duplicate.stock),
    revenue: prefer(primary.revenue, duplicate.revenue),
    employees: prefer(primary.employees, duplicate.employees),
    partners: prefer(primary.partners, duplicate.partners),
    profilePicUrl: prefer(primary.profilePicUrl, duplicate.profilePicUrl),
    followUpColumn: prefer(primary.followUpColumn, duplicate.followUpColumn),
    followUpMovedAt: latestDate(primary.followUpMovedAt, duplicate.followUpMovedAt),
    // A lead escolhido como principal continua aberto se já estava aberto.
    closedAt: primary.closedAt,
    lastReadAt: latestDate(primary.lastReadAt, duplicate.lastReadAt),
    stageEnteredAt: primary.stageEnteredAt ?? duplicate.stageEnteredAt,
  }

  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(merged)) {
    if (value !== primary[key as keyof typeof primary]) data[key] = value
  }
  return data as Prisma.LeadUpdateInput
}

const campaignStatusPriority: Record<string, number> = {
  PENDING: 0,
  SKIPPED: 1,
  FAILED: 2,
  SENT: 3,
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { keepId?: unknown; mergeId?: unknown }
  const keepId = typeof body.keepId === 'string' ? body.keepId : ''
  const mergeId = typeof body.mergeId === 'string' ? body.mergeId : ''
  if (!keepId || !mergeId || keepId === mergeId) {
    return NextResponse.json({ error: 'Informe dois leads diferentes para mesclar.' }, { status: 400 })
  }

  const [primary, duplicate] = await Promise.all([
    prisma.lead.findUnique({ where: { id: keepId }, select: mergeLeadSelect }),
    prisma.lead.findUnique({ where: { id: mergeId }, select: mergeLeadSelect }),
  ])
  if (!primary || !duplicate) return NextResponse.json({ error: 'Um dos leads não foi encontrado.' }, { status: 404 })

  const result = await prisma.$transaction(async (tx) => {
    const mergedFields = mergeLeadFields(primary, duplicate)
    if (Object.keys(mergedFields).length > 0) {
      await tx.lead.update({ where: { id: keepId }, data: mergedFields })
    }

    await tx.message.updateMany({ where: { leadId: mergeId }, data: { leadId: keepId } })
    await tx.followUpLog.updateMany({ where: { leadId: mergeId }, data: { leadId: keepId } })
    await tx.agendaEvent.updateMany({ where: { leadId: mergeId }, data: { leadId: keepId } })
    await tx.task.updateMany({ where: { leadId: mergeId }, data: { leadId: keepId } })
    await tx.negotiation.updateMany({ where: { leadId: mergeId }, data: { leadId: keepId } })

    const duplicateTags = await tx.leadTag.findMany({ where: { leadId: mergeId }, select: { tagId: true } })
    for (const tag of duplicateTags) {
      await tx.leadTag.upsert({
        where: { leadId_tagId: { leadId: keepId, tagId: tag.tagId } },
        update: {},
        create: { leadId: keepId, tagId: tag.tagId },
      })
    }
    await tx.leadTag.deleteMany({ where: { leadId: mergeId } })

    const duplicateCampaigns = await tx.bulkCampaignLead.findMany({
      where: { leadId: mergeId },
      select: { id: true, campaignId: true, status: true, sentAt: true, error: true },
    })
    for (const campaignLead of duplicateCampaigns) {
      const existing = await tx.bulkCampaignLead.findUnique({
        where: { campaignId_leadId: { campaignId: campaignLead.campaignId, leadId: keepId } },
      })
      if (!existing) {
        await tx.bulkCampaignLead.update({ where: { id: campaignLead.id }, data: { leadId: keepId } })
        continue
      }

      const duplicateIsBetter = (campaignStatusPriority[campaignLead.status] ?? 0) > (campaignStatusPriority[existing.status] ?? 0)
      if (duplicateIsBetter) {
        await tx.bulkCampaignLead.update({
          where: { id: existing.id },
          data: { status: campaignLead.status, sentAt: campaignLead.sentAt, error: campaignLead.error },
        })
      }
      await tx.bulkCampaignLead.delete({ where: { id: campaignLead.id } })
    }

    await tx.lead.delete({ where: { id: mergeId } })
    return { keptLeadId: keepId, mergedLeadId: mergeId }
  })

  return NextResponse.json({ ok: true, ...result })
}
