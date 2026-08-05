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
      let isOnWaWithLid = '0'
      if (tableNames.includes('IsOnWhatsapp')) {
        const cols = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'IsOnWhatsapp' ORDER BY ordinal_position`
        )
        isOnWaCols = cols.rows.map(r => r.column_name)
        const sample = await client.query(`SELECT * FROM "IsOnWhatsapp" WHERE lid IS NOT NULL LIMIT 5`)
        isOnWaSample = sample.rows
        const cnt = await client.query<{ count: string }>(`SELECT COUNT(*) as count FROM "IsOnWhatsapp"`)
        isOnWaCount = cnt.rows[0]?.count ?? '0'
        const cntLid = await client.query<{ count: string }>(`SELECT COUNT(*) as count FROM "IsOnWhatsapp" WHERE lid IS NOT NULL`)
        isOnWaWithLid = cntLid.rows[0]?.count ?? '0'
      }

      // Count how many LID chats have phone via Message table
      const resolvedCount = await client.query<{ count: string }>(
        `SELECT COUNT(DISTINCT key->>'remoteJid') as count FROM "Message"
         WHERE key->>'remoteJid' LIKE '%@lid' AND key->>'remoteJidAlt' LIKE '%@s.whatsapp.net'`
      )

      // Fetch findLabels raw response to see all fields (may include chats)
      let findLabelsRaw: unknown = null
      try {
        const lRes = await fetch(`${process.env.EVOLUTION_API_URL?.replace(/\/$/, '')}/label/findLabels/${process.env.EVOLUTION_INSTANCE_NAME}`, {
          headers: { apikey: process.env.EVOLUTION_API_KEY ?? '' },
        })
        const lData = await lRes.json()
        // Return first 2 labels with ALL fields so we can see what's available
        findLabelsRaw = Array.isArray(lData) ? lData.slice(0, 2) : lData
      } catch { /* ignore */ }

      return NextResponse.json({
        tables: tableNames,
        contactCols, contactSample,
        lidChatsWithLabels: lidCount.rows[0]?.count,
        resolvedLidsViaMessages: resolvedCount.rows[0]?.count,
        isOnWa: { cols: isOnWaCols, count: isOnWaCount, withLid: isOnWaWithLid, sample: isOnWaSample },
        findLabelsRaw,
      })
    } finally {
      await client.end().catch(() => {})
    }
  }

  // Pega os labels reais para usar IDs reais no teste
  const labelsRes = await evo(`/label/findLabels/${INSTANCE}`, { method: 'GET' })
  const labelsData = labelsRes.ok ? (labelsRes.body as unknown[]) : []
  const realLabels = Array.isArray(labelsData) ? labelsData.slice(0, 3) as Record<string, unknown>[] : []
  const testLabelId = realLabels[0] ? String(realLabels[0].id) : '9'

  // Testa diferentes variações do mesmo filtro para identificar o que funciona
  const [rA, rB, rC, rD, rE] = await Promise.all([
    // A: take:5 (confirmado funcionando antes)
    evo(`/chat/findChats/${INSTANCE}`, {
      method: 'POST',
      body: JSON.stringify({ where: { labels: { array_contains: testLabelId } }, take: 5 }),
    }),
    // B: take:500 skip:0 (o que estava sendo usado no import — pode estar quebrando)
    evo(`/chat/findChats/${INSTANCE}`, {
      method: 'POST',
      body: JSON.stringify({ where: { labels: { array_contains: testLabelId } }, take: 500, skip: 0 }),
    }),
    // C: page:1 offset:500 (igual ao findMessages — nova tentativa)
    evo(`/chat/findChats/${INSTANCE}`, {
      method: 'POST',
      body: JSON.stringify({ where: { labels: { array_contains: testLabelId } }, page: 1, offset: 500 }),
    }),
    // D: count:500 pageIndex:0 + where (o original que retornava tudo — verificar se com where filtra)
    evo(`/chat/findChats/${INSTANCE}`, {
      method: 'POST',
      body: JSON.stringify({ where: { labels: { array_contains: testLabelId } }, count: 500, pageIndex: 0 }),
    }),
    // E: sem paginação nenhuma com where (só o where)
    evo(`/chat/findChats/${INSTANCE}`, {
      method: 'POST',
      body: JSON.stringify({ where: { labels: { array_contains: testLabelId } } }),
    }),
  ])

  const fmt = (r: { status: number; body: unknown }) => ({
    status: r.status,
    count: Array.isArray(r.body) ? r.body.length : null,
    body: typeof r.body === 'string' ? r.body.slice(0, 150) : Array.isArray(r.body) ? (r.body as unknown[]).slice(0, 1) : r.body,
  })

  // Contagem de LeadTag no banco para cada tag WA
  const tagCounts = await prisma.crmTag.findMany({
    where: { waLabelId: { not: null } },
    select: { name: true, waLabelId: true, _count: { select: { leads: true } } },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({
    testLabelId,
    realLabels: realLabels.map(l => ({ id: l.id, name: l.name })),
    pagination: {
      'A: take:5 (baseline)': fmt(rA),
      'B: take:500 skip:0': fmt(rB),
      'C: page:1 offset:500': fmt(rC),
      'D: count:500 pageIndex:0 + where': fmt(rD),
      'E: só where sem paginação': fmt(rE),
    },
    dbTagCounts: tagCounts,
  })
}
