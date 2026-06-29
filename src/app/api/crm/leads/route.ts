// src/app/api/crm/leads/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leads = await prisma.lead.findMany({
    select: { id: true, name: true, phone: true, temperature: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(leads)
}
