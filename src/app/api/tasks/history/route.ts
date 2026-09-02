import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { attachTaskContext, taskLeadInclude } from '@/lib/task-context'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const tasks = await prisma.task.findMany({
    where: {
      source: 'tasks',
      completedAt: {
        gte: thirtyDaysAgo,
        not: null,
      },
    } as object,
    orderBy: { completedAt: 'desc' } as object,
    include: taskLeadInclude,
  })

  return NextResponse.json(await attachTaskContext(tasks))
}
