import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/crm/campaigns — lista campanhas (sem mediaBase64)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaigns = await prisma.bulkCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, message: true,
      mediaType: true, mimeType: true, fileName: true, mediaCaption: true,
      status: true, scheduledAt: true, startedAt: true, completedAt: true,
      totalLeads: true, sentCount: true, failedCount: true, delaySeconds: true,
      createdAt: true, updatedAt: true,
    },
  })

  return NextResponse.json(campaigns)
}

// POST /api/crm/campaigns — cria campanha
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    title: string
    message?: string
    mediaBase64?: string
    mediaType?: string
    mimeType?: string
    fileName?: string
    mediaCaption?: string
    scheduledAt?: string
    delaySeconds?: number
    // Filtro de destinatários (resolvido no servidor)
    filter: { type: 'all' | 'stages' | 'labels'; ids?: string[] }
  }

  if (!body.title?.trim()) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
  if (!body.filter?.type) return NextResponse.json({ error: 'Informe o filtro de destinatários' }, { status: 400 })
  if (!body.message?.trim() && !body.mediaBase64) {
    return NextResponse.json({ error: 'Informe uma mensagem ou mídia' }, { status: 400 })
  }

  // Resolve os leads pelo filtro
  let leads: { id: string }[] = []
  if (body.filter.type === 'all') {
    leads = await prisma.lead.findMany({ select: { id: true } })
  } else if (body.filter.type === 'stages' && body.filter.ids?.length) {
    leads = await prisma.lead.findMany({
      where: { stageId: { in: body.filter.ids }, followUpColumn: null },
      select: { id: true },
    })
  } else if (body.filter.type === 'labels' && body.filter.ids?.length) {
    const tags = await prisma.leadTag.findMany({
      where: { tagId: { in: body.filter.ids } },
      select: { leadId: true },
      distinct: ['leadId'],
    })
    leads = tags.map((t) => ({ id: t.leadId }))
  }

  if (!leads.length) return NextResponse.json({ error: 'Nenhum lead encontrado com o filtro selecionado' }, { status: 400 })

  const campaign = await prisma.bulkCampaign.create({
    data: {
      title: body.title.trim(),
      message: body.message?.trim() || null,
      mediaBase64: body.mediaBase64 || null,
      mediaType: body.mediaType || null,
      mimeType: body.mimeType || null,
      fileName: body.fileName || null,
      mediaCaption: body.mediaCaption?.trim() || null,
      status: 'SCHEDULED',
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : new Date(),
      totalLeads: leads.length,
      delaySeconds: body.delaySeconds ?? 7,
      leads: {
        createMany: {
          data: leads.map((l) => ({ leadId: l.id, status: 'PENDING' })),
          skipDuplicates: true,
        },
      },
    },
    select: { id: true, title: true, status: true, scheduledAt: true, totalLeads: true },
  })

  return NextResponse.json(campaign, { status: 201 })
}
