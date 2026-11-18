import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isTaskColumnKey, TASK_COLUMN_LABEL_MAX } from '@/lib/task-columns'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const labels = await prisma.taskColumnLabel.findMany()
  return NextResponse.json(labels)
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key, label } = await request.json()
  const trimmed = typeof label === 'string' ? label.trim() : ''

  if (!isTaskColumnKey(key)) {
    return NextResponse.json({ error: 'Coluna desconhecida.' }, { status: 400 })
  }
  if (!trimmed || trimmed.length > TASK_COLUMN_LABEL_MAX) {
    return NextResponse.json(
      { error: `O nome precisa ter de 1 a ${TASK_COLUMN_LABEL_MAX} caracteres.` },
      { status: 400 }
    )
  }

  const saved = await prisma.taskColumnLabel.upsert({
    where: { key },
    update: { label: trimmed },
    create: { key, label: trimmed },
  })

  return NextResponse.json(saved)
}
