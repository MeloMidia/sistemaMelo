import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const campaign = await prisma.bulkCampaign.findUnique({
    where: { id },
    include: {
      leads: {
        orderBy: { id: 'asc' },
        include: { lead: { select: { id: true, name: true, phone: true } } },
      },
    },
  })

  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  // Remove mediaBase64 from response to save bandwidth
  const { mediaBase64: _mb, ...rest } = campaign
  return NextResponse.json(rest)
}

export async function PATCH(request: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { action } = await request.json() as { action: 'cancel' }

  if (action === 'cancel') {
    const campaign = await prisma.bulkCampaign.findUnique({ where: { id } })
    if (!campaign) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
    if (!['SCHEDULED', 'RUNNING'].includes(campaign.status)) {
      return NextResponse.json({ error: 'Apenas campanhas agendadas ou em execução podem ser canceladas' }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.bulkCampaign.update({ where: { id }, data: { status: 'CANCELLED' } }),
      prisma.bulkCampaignLead.updateMany({
        where: { campaignId: id, status: 'PENDING' },
        data: { status: 'SKIPPED' },
      }),
    ])

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const campaign = await prisma.bulkCampaign.findUnique({ where: { id } })
  if (!campaign) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  if (campaign.status === 'RUNNING') {
    return NextResponse.json({ error: 'Cancele a campanha antes de excluir' }, { status: 400 })
  }

  await prisma.bulkCampaign.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
