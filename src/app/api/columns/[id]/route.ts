import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { title, color, order } = await request.json()

  const column = await prisma.column.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(color !== undefined && { color }),
      ...(order !== undefined && { order }),
    },
  })

  return NextResponse.json(column)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await prisma.column.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
