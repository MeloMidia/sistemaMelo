import { randomUUID } from 'crypto'
import { Client } from 'pg'
import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const COMMERCIAL_RESET_TOKEN_HEADER = 'x-reset-token'

const CRM_STAGES = [
  { name: 'Novos leads', order: 1000, color: '#2f855a' },
  { name: 'Em atendimento', order: 2000, color: '#3b6fd8' },
  { name: 'Qualificados', order: 3000, color: '#8b5cf6' },
  { name: 'Agendados', order: 4000, color: '#d6922e' },
  { name: 'Proposta enviada', order: 5000, color: '#c45b3c' },
  { name: 'Fechados', order: 6000, color: '#15724f' },
] as const

const NEGOTIATION_COLUMNS = ['Não atribuídas', 'Em negociação', 'Ganho', 'Perdido'] as const

type CountMap = Record<string, number>

type MutationResult = {
  name: string
  affectedRows: number
}

function isAuthorized(request: NextRequest) {
  const expectedToken = process.env.RESET_COMMERCIAL_TOKEN
  const receivedToken = request.headers.get(COMMERCIAL_RESET_TOKEN_HEADER)

  return Boolean(expectedToken) && receivedToken === expectedToken
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function getDatabaseClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL não configurado.')

  return new Client({ connectionString })
}

async function countCommercialData(client: Client): Promise<CountMap> {
  const queries = [
    ['leads', `select count(*)::int as count from "Lead"`],
    ['messages', `select count(*)::int as count from "Message"`],
    ['leadLinkedAgendaEvents', `select count(*)::int as count from "AgendaEvent" where "leadId" is not null`],
    ['leadStages', `select count(*)::int as count from "LeadStage"`],
    ['stageLeads', `select count(*)::int as count from "LeadStage" s join "Lead" l on l."stageId" = s.id`],
    ['followUpLogs', `select count(*)::int as count from "FollowUpLog"`],
    ['crmTags', `select count(*)::int as count from "CrmTag"`],
    ['leadTags', `select count(*)::int as count from "LeadTag"`],
    ['negotiations', `select count(*)::int as count from "Negotiation"`],
    ['negotiationTags', `select count(*)::int as count from "NegotiationTag"`],
    ['negotiationTasks', `select count(*)::int as count from "Task" where source = 'negotiations'`],
    ['leadLinkedTasks', `select count(*)::int as count from "Task" where source = 'tasks' and "leadId" is not null`],
    ['commercialTaskTags', `select count(*)::int as count from "TaskTag" where "taskId" in (select id from "Task" where source = 'negotiations' or (source = 'tasks' and "leadId" is not null))`],
    ['bulkCampaigns', `select count(*)::int as count from "BulkCampaign"`],
    ['bulkCampaignLeads', `select count(*)::int as count from "BulkCampaignLead"`],
    ['dashboardMetrics', `select count(*)::int as count from "DashboardMetric"`],
    ['dashboardGoalsWithValues', `select count(*)::int as count from "DashboardGoal" where leads <> 0 or "reunioesAgendadas" <> 0 or "reunioesRealizadas" <> 0 or faturamento <> 0`],
    ['sdrDailyLogs', `select count(*)::int as count from "SdrDailyLog"`],
    ['whatsappConnections', `select count(*)::int as count from "WhatsappConnection"`],
    ['negotiationColumns', `select count(*)::int as count from "Column" where source = 'negotiations'`],
  ] as const

  const entries = await Promise.all(
    queries.map(async ([name, sql]) => {
      const result = await client.query<{ count: number }>(sql)
      return [name, result.rows[0]?.count ?? 0] as const
    })
  )

  return Object.fromEntries(entries)
}

async function executeMutation(client: Client, name: string, sql: string, values?: unknown[]): Promise<MutationResult> {
  const result = await client.query(sql, values)
  return { name, affectedRows: result.rowCount ?? 0 }
}

async function resetCommercialData(client: Client) {
  const mutations: MutationResult[] = []

  await client.query('begin')

  try {
    mutations.push(await executeMutation(client, 'negotiationTagsDeleted', `delete from "NegotiationTag"`))
    mutations.push(await executeMutation(client, 'negotiationsDeleted', `delete from "Negotiation"`))
    mutations.push(await executeMutation(
      client,
      'commercialTaskTagsDeleted',
      `delete from "TaskTag" where "taskId" in (select id from "Task" where source = 'negotiations' or (source = 'tasks' and "leadId" is not null))`
    ))
    mutations.push(await executeMutation(
      client,
      'commercialTasksDeleted',
      `delete from "Task" where source = 'negotiations' or (source = 'tasks' and "leadId" is not null)`
    ))
    mutations.push(await executeMutation(client, 'messagesDeleted', `delete from "Message"`))
    mutations.push(await executeMutation(client, 'followUpLogsDeleted', `delete from "FollowUpLog"`))
    mutations.push(await executeMutation(client, 'leadTagsDeleted', `delete from "LeadTag"`))
    mutations.push(await executeMutation(client, 'bulkCampaignLeadsDeleted', `delete from "BulkCampaignLead"`))
    mutations.push(await executeMutation(client, 'bulkCampaignsDeleted', `delete from "BulkCampaign"`))
    mutations.push(await executeMutation(client, 'leadLinkedAgendaEventsDeleted', `delete from "AgendaEvent" where "leadId" is not null`))
    mutations.push(await executeMutation(client, 'leadsDeleted', `delete from "Lead"`))
    mutations.push(await executeMutation(client, 'crmTagsDeleted', `delete from "CrmTag"`))
    mutations.push(await executeMutation(client, 'leadStagesDeleted', `delete from "LeadStage"`))
    mutations.push(await executeMutation(client, 'dashboardMetricsDeleted', `delete from "DashboardMetric"`))
    mutations.push(await executeMutation(client, 'sdrDailyLogsDeleted', `delete from "SdrDailyLog"`))
    mutations.push(await executeMutation(
      client,
      'dashboardGoalsZeroed',
      `update "DashboardGoal" set leads = 0, "reunioesAgendadas" = 0, "reunioesRealizadas" = 0, faturamento = 0, "updatedAt" = now()`
    ))
    mutations.push(await executeMutation(client, 'negotiationColumnsDeleted', `delete from "Column" where source = 'negotiations'`))

    for (const stage of CRM_STAGES) {
      mutations.push(await executeMutation(
        client,
        `crmStageCreated:${stage.name}`,
        `insert into "LeadStage" (id, name, "order", color) values ($1, $2, $3, $4)`,
        [randomUUID(), stage.name, stage.order, stage.color]
      ))
    }

    for (const [index, title] of NEGOTIATION_COLUMNS.entries()) {
      mutations.push(await executeMutation(
        client,
        `negotiationColumnCreated:${title}`,
        `insert into "Column" (id, title, "order", source, "createdAt") values ($1, $2, $3, 'negotiations', now())`,
        [randomUUID(), title, (index + 1) * 1000]
      ))
    }

    await client.query('commit')
    return mutations
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  const client = getDatabaseClient()
  await client.connect()

  try {
    const counts = await countCommercialData(client)
    return NextResponse.json({ ok: true, counts })
  } finally {
    await client.end().catch(() => undefined)
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  const client = getDatabaseClient()
  await client.connect()

  try {
    const before = await countCommercialData(client)
    const mutations = await resetCommercialData(client)
    const after = await countCommercialData(client)

    return NextResponse.json({ ok: true, before, mutations, after })
  } finally {
    await client.end().catch(() => undefined)
  }
}
