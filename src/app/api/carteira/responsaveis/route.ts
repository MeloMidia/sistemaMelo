import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const labels = await prisma.responsavelLabel.findMany()
  return NextResponse.json(labels)
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key, label } = await request.json()
  const trimmed = typeof label === 'string' ? label.trim() : ''

  if (!key || !trimmed) {
    return NextResponse.json({ error: 'Informe key e label.' }, { status: 400 })
  }

  const saved = await prisma.responsavelLabel.upsert({
    where: { key },
    update: { label: trimmed },
    create: { key, label: trimmed },
  })

  return NextResponse.json(saved)
}
