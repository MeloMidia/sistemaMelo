import { NextResponse } from 'next/server'
import { requireAuth, fastapiRequest } from '@/lib/automacao-proxy'

export async function GET(request: Request) {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id') ?? ''

  const res = await fastapiRequest(`/api/sheets?client_id=${encodeURIComponent(clientId)}`)
  const data = await res.json()
  return NextResponse.json(data)
}
