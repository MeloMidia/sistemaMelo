// src/app/api/crm/tags/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tags = await prisma.crmTag.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(tags)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, color } = await request.json()
  const tag = await prisma.crmTag.create({ data: { name, color: color || '#64748b' } })
  return NextResponse.json(tag)
}
