import { requireAuth, fastapiRequest, proxyJson } from '@/lib/automacao-proxy'

export async function POST() {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const res = await fastapiRequest('/api/cancel', { method: 'POST' })
  return proxyJson(res)
}
