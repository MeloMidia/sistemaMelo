import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_UNANSWERED_HOURS } from '@/lib/crm-lead-rules'

export const runtime = 'nodejs'

type UnansweredLeadRow = {
  id: string
  name: string | null
  phone: string
  profilePicUrl: string | null
  stageId: string | null
  stageName: string | null
  stageColor: string | null
  assignedToId: string | null
  assignedToName: string | null
  lastMessageId: string
  lastMessageContent: string
  lastMessageCreatedAt: Date
  totalCount: number
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = new URL(request.url).searchParams
  const requestedHours = Number(params.get('hours') ?? DEFAULT_UNANSWERED_HOURS)
  const requestedLimit = Number(params.get('limit') ?? 50)
  const hours = Number.isFinite(requestedHours) ? Math.min(Math.max(Math.round(requestedHours), 1), 720) : DEFAULT_UNANSWERED_HOURS
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.round(requestedLimit), 1), 100) : 50
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)

  const rows = await prisma.$queryRaw<UnansweredLeadRow[]>(Prisma.sql`
    SELECT
      l."id",
      l."name",
      l."phone",
      l."profilePicUrl",
      l."stageId",
      s."name" AS "stageName",
      s."color" AS "stageColor",
      l."assignedToId",
      u."name" AS "assignedToName",
      latest."id" AS "lastMessageId",
      latest."content" AS "lastMessageContent",
      latest."createdAt" AS "lastMessageCreatedAt",
      COUNT(*) OVER()::int AS "totalCount"
    FROM "Lead" l
    JOIN LATERAL (
      SELECT m."id", m."content", m."direction", m."createdAt"
      FROM "Message" m
      WHERE m."leadId" = l."id"
        AND m."whatsappMessageId" NOT LIKE 'note-%'
      ORDER BY m."createdAt" DESC
      LIMIT 1
    ) latest ON TRUE
    LEFT JOIN "LeadStage" s ON s."id" = l."stageId"
    LEFT JOIN "User" u ON u."id" = l."assignedToId"
    WHERE l."closedAt" IS NULL
      AND latest."direction" = 'INBOUND'
      AND latest."createdAt" <= ${cutoff}
    ORDER BY latest."createdAt" ASC
    LIMIT ${limit}
  `)

  const total = rows[0]?.totalCount ?? 0
  return NextResponse.json({
    hours,
    total,
    hasMore: total > rows.length,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      profilePicUrl: row.profilePicUrl,
      stage: row.stageId ? { id: row.stageId, name: row.stageName, color: row.stageColor } : null,
      assignedTo: row.assignedToId ? { id: row.assignedToId, name: row.assignedToName } : null,
      lastMessage: {
        id: row.lastMessageId,
        content: row.lastMessageContent,
        createdAt: row.lastMessageCreatedAt,
      },
    })),
  })
}

