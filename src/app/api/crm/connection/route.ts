// src/app/api/crm/connection/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connection = await prisma.whatsappConnection.findFirst()
  return NextResponse.json(connection ?? { status: 'close' })
}
