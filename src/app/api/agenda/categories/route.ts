// src/app/api/agenda/categories/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const categories = await prisma.eventCategory.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(categories)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, color } = await request.json()
  if (!name || !color) {
    return NextResponse.json({ error: 'Nome e cor são obrigatórios' }, { status: 400 })
  }

  const category = await prisma.eventCategory.create({ data: { name, color } })
  return NextResponse.json(category)
}
