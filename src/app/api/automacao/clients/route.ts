import { NextResponse } from 'next/server'
import { requireAuth, fastapiRequest } from '@/lib/automacao-proxy'

export async function GET() {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const res = await fastapiRequest('/api/clients')
  const data = await res.json()
  return NextResponse.json(data)
}
