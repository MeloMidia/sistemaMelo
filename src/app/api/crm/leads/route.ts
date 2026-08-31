// src/app/api/crm/leads/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizePhone } from '@/lib/phone'
import { ensureCrmPipeline } from '@/lib/crm-pipeline'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leads = await prisma.lead.findMany({
    select: { id: true, name: true, phone: true, temperature: true, notes: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(leads)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { name?: unknown; phone?: unknown; stageId?: unknown }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : '')

  if (!name) return NextResponse.json({ error: 'Informe o nome do lead.' }, { status: 400 })
  if (phone.length < 10) return NextResponse.json({ error: 'Informe um telefone válido.' }, { status: 400 })

  const entryStage = await ensureCrmPipeline()
  const requestedStageId = typeof body.stageId === 'string' ? body.stageId : entryStage.id
  const stage = await prisma.leadStage.findUnique({ where: { id: requestedStageId }, select: { id: true } })
  if (!stage) return NextResponse.json({ error: 'A etapa selecionada não existe.' }, { status: 400 })

  try {
    const lead = await prisma.lead.create({
      data: { name, phone, stageId: stage.id },
      include: {
        assignedTo: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
        _count: { select: { messages: true, tasks: true } },
      },
    })
    return NextResponse.json(lead, { status: 201 })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um lead com este telefone.' }, { status: 409 })
    }
    throw error
  }
}
