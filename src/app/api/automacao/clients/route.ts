import { requireAuth, fastapiRequest, proxyJson } from '@/lib/automacao-proxy'

export async function GET(request: Request) {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const parentId = new URL(request.url).searchParams.get('parent_id')
  const query = parentId ? `?parent_id=${encodeURIComponent(parentId)}` : ''

  const res = await fastapiRequest(`/api/clients${query}`)
  return proxyJson(res)
}
