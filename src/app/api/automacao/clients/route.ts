import { requireAuth, fastapiRequest, proxyJson } from '@/lib/automacao-proxy'

export async function GET() {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const res = await fastapiRequest('/api/clients')
  return proxyJson(res)
}
