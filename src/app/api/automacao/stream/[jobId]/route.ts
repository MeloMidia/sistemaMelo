import { requireAuth, fastapiRequest } from '@/lib/automacao-proxy'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const { jobId } = await params

  const fastapiRes = await fastapiRequest(`/api/stream/${jobId}`)

  return new Response(fastapiRes.body, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
