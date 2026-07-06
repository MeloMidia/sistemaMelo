/**
 * Endpoint de investigação do schema da Evolution API.
 * Rota: GET /api/crm/import/investigate
 * Retorna o schema completo do banco da Evolution e amostras de dados.
 * REMOVER após usar.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Client } from 'pg'

const EVO_DB_URL = process.env.EVOLUTION_DB_URL ?? ''
const INSTANCE   = process.env.EVOLUTION_INSTANCE_NAME ?? ''

async function query<T extends Record<string, unknown>>(
  client: Client,
  sql: string,
  params: unknown[] = []
): Promise<{ rows: T[]; error?: string }> {
  try {
    const res = await client.query<T>(sql, params)
    return { rows: res.rows }
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : String(err) }
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!EVO_DB_URL) {
    return NextResponse.json({ error: 'EVOLUTION_DB_URL não configurada' }, { status: 500 })
  }

  const client = new Client({ connectionString: EVO_DB_URL, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()

    // ── 1. Todas as tabelas públicas ────────────────────────────────────────
    const allTables = await query<{ tablename: string }>(
      client,
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    )
    const tableNames = allTables.rows.map(r => r.tablename)

    // ── 2. Tabelas de interesse: qualquer coisa com label, chat, contact ────
    const labelTables = tableNames.filter(t =>
      /label|chat|contact|message|jid|lead|association|tag/i.test(t)
    )

    // ── 3. Inspecionar colunas de cada tabela de interesse ──────────────────
    const tableSchemas: Record<string, { columns: string[]; rowCount: string; sample: unknown[] }> = {}
    for (const tbl of labelTables) {
      const cols = await query<{ column_name: string; data_type: string; udt_name: string }>(
        client,
        `SELECT column_name, data_type, udt_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [tbl]
      )
      const cnt = await query<{ c: string }>(
        client,
        `SELECT COUNT(*)::text AS c FROM "${tbl}"`
      )
      const sample = await query(
        client,
        `SELECT * FROM "${tbl}" LIMIT 3`
      )
      tableSchemas[tbl] = {
        columns: cols.rows.map(c => `${c.column_name} (${c.data_type}${c.udt_name === '_text' ? '[]' : ''})`),
        rowCount: cnt.rows[0]?.c ?? '?',
        sample: sample.rows,
      }
    }

    // ── 4. Chat: campo labels ───────────────────────────────────────────────
    // Verificar se existe, tipo real, e amostra de chat COM label
    let chatLabelsSample: unknown[] = []
    let chatLabelsError: string | undefined
    if (tableNames.includes('Chat')) {
      const res = await query(
        client,
        `SELECT "remoteJid", labels, name, "pushName", "instanceId"
         FROM "Chat"
         WHERE labels IS NOT NULL
           AND labels::text NOT IN ('[]', 'null', '""', '')
         LIMIT 5`
      )
      chatLabelsSample = res.rows
      chatLabelsError  = res.error
    }

    // ── 5. Tabela Label separada? ───────────────────────────────────────────
    // Testar variações de nome
    const labelTableCandidates = ['Label', 'label', 'Labels', 'WaLabel', 'ChatLabel']
    const foundLabelTables: Record<string, unknown[]> = {}
    for (const tbl of labelTableCandidates) {
      if (tableNames.includes(tbl)) {
        const res = await query(client, `SELECT * FROM "${tbl}" LIMIT 5`)
        foundLabelTables[tbl] = res.rows
      }
    }

    // ── 6. Tabela de associação label ↔ chat? ───────────────────────────────
    const assocCandidates = [
      'LabelAssociation', 'ChatLabel', 'chat_label', 'label_chat',
      'LabelChat', 'ChatLabels', 'LabelAssoc',
    ]
    const foundAssocTables: Record<string, unknown[]> = {}
    for (const tbl of assocCandidates) {
      if (tableNames.includes(tbl)) {
        const res = await query(client, `SELECT * FROM "${tbl}" LIMIT 5`)
        foundAssocTables[tbl] = res.rows
      }
    }

    // ── 7. Tentar query de vínculo direto (label em campo array no Chat) ─────
    let joinQuery: { rows: unknown[]; error?: string } = { rows: [] }
    if (tableNames.includes('Chat')) {
      // Caso 1: labels como JSONB array de objetos { id, name, color }
      const q1 = await query(
        client,
        `SELECT c."remoteJid", c."instanceId",
                elem->>'id' AS label_id,
                elem->>'name' AS label_name,
                elem->>'color' AS label_color
         FROM "Chat" c,
              jsonb_array_elements(
                CASE WHEN jsonb_typeof(c.labels::jsonb) = 'array'
                     THEN c.labels::jsonb
                     ELSE '[]'::jsonb END
              ) AS elem
         WHERE c.labels IS NOT NULL
           AND c.labels::text NOT IN ('[]', 'null', '')
         LIMIT 10`
      )
      if (q1.rows.length > 0) {
        joinQuery = { rows: q1.rows, error: undefined }
      } else {
        // Caso 2: labels como JSONB array de strings (IDs simples)
        const q2 = await query(
          client,
          `SELECT c."remoteJid", c."instanceId",
                  elem#>>'{}' AS label_id
           FROM "Chat" c,
                jsonb_array_elements(
                  CASE WHEN jsonb_typeof(c.labels::jsonb) = 'array'
                       THEN c.labels::jsonb
                       ELSE '[]'::jsonb END
                ) AS elem
           WHERE c.labels IS NOT NULL
             AND c.labels::text NOT IN ('[]', 'null', '')
           LIMIT 10`
        )
        joinQuery = q2.rows.length > 0
          ? { rows: q2.rows }
          : { rows: [], error: q1.error ?? q2.error }
      }
    }

    // ── 8. Instâncias presentes no Chat ─────────────────────────────────────
    let instancesInChat: unknown[] = []
    if (tableNames.includes('Chat')) {
      const res = await query(
        client,
        `SELECT DISTINCT "instanceId", COUNT(*) AS chats
         FROM "Chat"
         GROUP BY "instanceId"
         ORDER BY chats DESC
         LIMIT 10`
      )
      instancesInChat = res.rows
    }

    // ── 9. Count de chats com label na instância atual ──────────────────────
    let chatsWithLabelsCount: unknown = null
    if (tableNames.includes('Chat') && INSTANCE) {
      const res = await query<{ c: string }>(
        client,
        `SELECT COUNT(*)::text AS c FROM "Chat"
         WHERE "instanceId" = $1
           AND labels IS NOT NULL
           AND labels::text NOT IN ('[]', 'null', '')`,
        [INSTANCE]
      )
      chatsWithLabelsCount = res.rows[0]?.c
    }

    return NextResponse.json({
      meta: {
        instance: INSTANCE,
        totalTables: tableNames.length,
        labelRelatedTables: labelTables,
      },
      allTables: tableNames,
      tableSchemas,
      chatLabelsSample,
      chatLabelsError,
      foundLabelTables,
      foundAssocTables,
      labelJoinQuery: joinQuery,
      instancesInChat,
      chatsWithLabelsCount,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  } finally {
    await client.end().catch(() => {})
  }
}
