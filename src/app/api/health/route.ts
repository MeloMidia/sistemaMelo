import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConnectionState } from '@/lib/evolution-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = performance.now()
  const checks: Record<string, 'ok' | 'error' | 'not_configured'> = {
    database: 'error',
    evolution: 'not_configured',
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch (error) {
    console.error('[health] Banco indisponível', error)
  }

  if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE_NAME) {
    try {
      await getConnectionState()
      checks.evolution = 'ok'
    } catch (error) {
      checks.evolution = 'error'
      console.error('[health] Evolution API indisponível', error)
    }
  }

  const healthy = checks.database === 'ok'
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      checks,
      latencyMs: Math.round(performance.now() - startedAt),
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  )
}
