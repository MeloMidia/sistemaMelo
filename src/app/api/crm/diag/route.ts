// Endpoint temporário de diagnóstico — remover após o uso
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const BASE_URL = (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '')
const API_KEY  = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

async function evo(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', apikey: API_KEY, ...(init?.headers ?? {}) },
  })
  const text = await res.text()
  let body: unknown
  try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, ok: res.ok, body }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // If ?evo=1, probe Evolution API's PostgreSQL schema
  if (new URL(request.url).searchParams.has('evo')) {
    const { Client } = await import('pg')
    const client = new Client({ connectionString: process.env.EVOLUTION_DB_URL, ssl: { rejectUnauthorized: false } })
    try {
      await client.connect()
      const tables = await client.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
      )
      const tableNames = tables.rows.map(r => r.tablename)

      // Probe Contact table if it exists
      let contactCols: string[] = []
      let contactSample: unknown[] = []
      if (tableNames.includes('Contact')) {
        const cols = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'Contact' ORDER BY ordinal_position`
        )
        contactCols = cols.rows.map(r => r.column_name)
        const sample = await client.query(`SELECT * FROM "Contact" LIMIT 3`)
        contactSample = sample.rows
      }

      // Count LID chats without phone resolution
      const lidCount = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM "Chat" WHERE "remoteJid" LIKE '%@lid' AND labels IS NOT NULL AND labels::text != '[]'`
      )

      // Probe IsOnWhatsapp table (may have jid→phone cached lookups)
      let isOnWaCols: string[] = []
      let isOnWaSample: unknown[] = []
      let isOnWaCount = '0'
      if (tableNames.includes('IsOnWhatsapp')) {
        const cols = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'IsOnWhatsapp' ORDER BY ordinal_position`
        )
        isOnWaCols = cols.rows.map(r => r.column_name)
        const sample = await client.query(`SELECT * FROM "IsOnWhatsapp" LIMIT 5`)
        isOnWaSample = sample.rows
        const cnt = await client.query<{ count: string }>(`SELECT COUNT(*) as count FROM "IsOnWhatsapp"`)
        isOnWaCount = cnt.rows[0]?.count ?? '0'
      }

      // Count how many LID chats have phone via Message table
      const resolvedCount = await client.query<{ count: string }>(
        `SELECT COUNT(DISTINCT key->>'remoteJid') as count FROM "Message"
         WHERE key->>'remoteJid' LIKE '%@lid' AND key->>'remoteJidAlt' LIKE '%@s.whatsapp.net'`
      )

      return NextResponse.json({
        tables: tableNames,
        contactCols, contactSample,
        lidChatsWithLabels: lidCount.rows[0]?.count,
        resolvedLidsViaMessages: resolvedCount.rows[0]?.count,
        isOnWa: { cols: isOnWaCols, count: isOnWaCount, sample: isOnWaSample },
      })
    } finally {
      await client.end().catch(() => {})
    }
  }

  const testLabelId = '9' // Frio

  // Try every plausible label-chat endpoint variant
  const [
    r1, r2, r3, r4, r5, r6, r7, r8,
  ] = await Promise.all([
    // Variant 1: POST with body labelId
    evo(`/label/findLabelChats/${INSTANCE}`, {
      method: 'POST',
      body: JSON.stringify({ labelId: testLabelId }),
    }),
    // Variant 2: POST with body id
    evo(`/label/findLabelChats/${INSTANCE}`, {
      method: 'POST',
      body: JSON.stringify({ id: testLabelId }),
    }),
    // Variant 3: GET with label ID in path
    evo(`/label/findLabelChats/${INSTANCE}/${testLabelId}`, { method: 'GET' }),
    // Variant 4: POST with label ID in path
    evo(`/label/findLabelChats/${INSTANCE}/${testLabelId}`, { method: 'POST', body: JSON.stringify({}) }),
    // Variant 5: fetchLabelChats GET
    evo(`/label/fetchLabelChats/${INSTANCE}`, { method: 'GET' }),
    // Variant 6: getLabelChats GET
    evo(`/label/getLabelChats/${INSTANCE}/${testLabelId}`, { method: 'GET' }),
    // Variant 7: chats endpoint under label path
    evo(`/label/chats/${INSTANCE}/${testLabelId}`, { method: 'GET' }),
    // Variant 8: findChats with JSON array contains (PostgreSQL)
    evo(`/chat/findChats/${INSTANCE}`, {
      method: 'POST',
      body: JSON.stringify({ where: { labels: { array_contains: testLabelId } }, take: 5 }),
    }),
  ])

  const fmt = (r: { status: number; body: unknown }) => ({
    status: r.status,
    count: Array.isArray(r.body) ? r.body.length : null,
    body: typeof r.body === 'string' ? r.body.slice(0, 150) : Array.isArray(r.body) ? r.body.slice(0, 2) : r.body,
  })

  return NextResponse.json({
    testLabelId,
    labelChatEndpoints: {
      'POST /findLabelChats body:{labelId}': fmt(r1),
      'POST /findLabelChats body:{id}': fmt(r2),
      'GET /findLabelChats/{labelId}': fmt(r3),
      'POST /findLabelChats/{labelId}': fmt(r4),
      'GET /fetchLabelChats': fmt(r5),
      'GET /getLabelChats/{labelId}': fmt(r6),
      'GET /chats/{labelId}': fmt(r7),
      'POST findChats array_contains': fmt(r8),
    },
  })
}
