import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { subscribeCrmEvents } from '@/lib/crm-events'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return new Response('Unauthorized', { status: 401 })

  let unsubscribe: () => void = () => {}
  let heartbeat: ReturnType<typeof setInterval>

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(`: connected\n\n`))

      unsubscribe = subscribeCrmEvents((event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          unsubscribe()
          clearInterval(heartbeat)
        }
      })

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          unsubscribe()
          clearInterval(heartbeat)
        }
      }, 25_000)
    },
    cancel() {
      unsubscribe()
      clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  })
}
