import { NextResponse } from 'next/server'
import { requireAuth, fastapiRequest } from '@/lib/automacao-proxy'

export async function POST() {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const res = await fastapiRequest('/api/cancel', { method: 'POST' })
  const data = await res.json()
  return NextResponse.json(data)
}
