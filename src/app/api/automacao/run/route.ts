import { requireAuth, fastapiRequest, proxyJson } from '@/lib/automacao-proxy'

export async function POST(request: Request) {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const body = await request.json()
  const res = await fastapiRequest('/api/run', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return proxyJson(res)
}
