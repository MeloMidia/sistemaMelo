import { requireAuth, fastapiRequest } from '@/lib/automacao-proxy'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const { jobId } = await params

  try {
    const fastapiRes = await fastapiRequest(`/api/stream/${jobId}`)

    if (!fastapiRes.ok) {
      return new Response(fastapiRes.body, {
        status: fastapiRes.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(fastapiRes.body, {
      headers: {
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache',
        'X-Accel-Buffering': 'no',
        'Connection':        'keep-alive',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to stream logs' }, { status: 500 })
  }
}
