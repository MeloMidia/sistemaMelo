// src/app/api/crm/connection/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getConnectionState } from '@/lib/evolution-client'

async function persistConnectionStatus(status: string) {
  const existing = await prisma.whatsappConnection.findFirst()

  if (existing) {
    return prisma.whatsappConnection.update({
      where: { id: existing.id },
      data: { status },
    })
  }

  return prisma.whatsappConnection.create({ data: { status } })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connection = await prisma.whatsappConnection.findFirst()

  try {
    const result = await getConnectionState()
    const liveStatus = result.instance?.state

    if (liveStatus) {
      const syncedConnection = await persistConnectionStatus(liveStatus)
      return NextResponse.json(syncedConnection)
    }
  } catch (error) {
    console.warn(
      '[crm/connection] Falha ao consultar status na Evolution API:',
      error instanceof Error ? error.message : error
    )
  }

  return NextResponse.json(connection ?? { status: 'close' })
}
