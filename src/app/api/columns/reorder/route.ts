import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { items } = await request.json()
  if (!items?.length) return NextResponse.json({ success: true })

  const rows = (items as { id: string; order: number }[]).map(i =>
    Prisma.sql`(${i.id}::text, ${i.order}::int4)`
  )

  await prisma.$executeRaw`
    UPDATE "Column" AS c
    SET "order" = v.ord
    FROM (VALUES ${Prisma.join(rows)}) AS v(id, ord)
    WHERE c.id = v.id
  `

  return NextResponse.json({ success: true })
}
