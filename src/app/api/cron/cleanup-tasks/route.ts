import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isCronRequestAuthorized } from '@/lib/cron-auth'
import { taskHistoryCutoff } from '@/lib/task-history'

export const runtime = 'nodejs'

// Cron diário: exclui de vez as tarefas concluídas que já saíram do
// histórico. Some também do cartão do cliente e da aba Processos do lead,
// que listam as concluídas sem limite de data — decisão do usuário.
// `?dryRun=1` só conta, sem apagar.
export async function GET(request: Request) {
  if (!(await isCronRequestAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const where: Prisma.TaskWhereInput = {
    source: 'tasks',
    completedAt: { lt: taskHistoryCutoff() },
    // Negotiation → Task é onDelete: Cascade: apagar a tarefa levaria a
    // negociação (valor, serviço, etiquetas) junto.
    negotiation: { is: null },
  }

  const dryRun = new URL(request.url).searchParams.has('dryRun')

  try {
    const result = dryRun
      ? { dryRun: true, wouldDelete: await prisma.task.count({ where }) }
      : { deleted: (await prisma.task.deleteMany({ where })).count }
    console.log('[cleanup-tasks]', JSON.stringify(result))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[cleanup-tasks] erro:', error)
    return NextResponse.json({ ok: false, error }, { status: 500 })
  }
}
