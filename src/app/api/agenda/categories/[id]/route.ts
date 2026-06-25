// src/app/api/agenda/categories/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, color } = await request.json()

  try {
    const category = await prisma.eventCategory.update({
      where: { id },
      data: { ...(name !== undefined && { name }), ...(color !== undefined && { color }) },
    })
    return NextResponse.json(category)
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
    throw error
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    await prisma.eventCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ success: true })
    throw error
  }
}
