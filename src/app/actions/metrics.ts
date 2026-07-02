'use server'

import { prisma } from '@/lib/prisma'

export async function getDashboardData(startDate?: Date, endDate?: Date) {
  const where =
    startDate && endDate
      ? { date: { gte: new Date(startDate), lte: new Date(endDate) } }
      : {}

  const metrics = await prisma.dashboardMetric.findMany({ where })
  const goal = await prisma.dashboardGoal.findFirst()

  const aggregated = metrics.reduce(
    (acc, curr) => ({
      leadsTrafego: acc.leadsTrafego + curr.leadsTrafego,
      leadsIndicacao: acc.leadsIndicacao + curr.leadsIndicacao,
      reunioesAgendadas: acc.reunioesAgendadas + curr.reunioesAgendadas,
      reunioesRealizadas: acc.reunioesRealizadas + curr.reunioesRealizadas,
      vendasQtd: acc.vendasQtd + curr.vendasQtd,
      faturamento: acc.faturamento + curr.faturamento,
      investimentoTrafego: acc.investimentoTrafego + curr.investimentoTrafego,
    }),
    {
      leadsTrafego: 0,
      leadsIndicacao: 0,
      reunioesAgendadas: 0,
      reunioesRealizadas: 0,
      vendasQtd: 0,
      faturamento: 0,
      investimentoTrafego: 0,
    }
  )

  let currentGoal = goal
  if (!currentGoal) {
    try {
      currentGoal = await prisma.dashboardGoal.create({ data: {} })
    } catch {
      currentGoal = await prisma.dashboardGoal.findFirst()
    }
  }

  return { metrics: aggregated, goals: currentGoal! }
}

export async function addDashboardMetric(data: {
  leadsTrafego: number
  leadsIndicacao: number
  reunioesAgendadas: number
  reunioesRealizadas: number
  vendasQtd: number
  faturamento: number
  investimentoTrafego: number
}) {
  const newMetric = await prisma.dashboardMetric.create({
    data: {
      leadsTrafego: Number(data.leadsTrafego),
      leadsIndicacao: Number(data.leadsIndicacao),
      reunioesAgendadas: Number(data.reunioesAgendadas),
      reunioesRealizadas: Number(data.reunioesRealizadas),
      vendasQtd: Number(data.vendasQtd),
      faturamento: Number(data.faturamento),
      investimentoTrafego: Number(data.investimentoTrafego),
    },
  })
  return { success: true, metric: newMetric }
}

export async function overwriteDashboardMetrics(data: {
  leadsTrafego: number
  leadsIndicacao: number
  reunioesAgendadas: number
  reunioesRealizadas: number
  vendasQtd: number
  faturamento: number
  investimentoTrafego: number
}) {
  await prisma.dashboardMetric.deleteMany()
  const newMetric = await prisma.dashboardMetric.create({
    data: {
      leadsTrafego: Number(data.leadsTrafego),
      leadsIndicacao: Number(data.leadsIndicacao),
      reunioesAgendadas: Number(data.reunioesAgendadas),
      reunioesRealizadas: Number(data.reunioesRealizadas),
      vendasQtd: Number(data.vendasQtd),
      faturamento: Number(data.faturamento),
      investimentoTrafego: Number(data.investimentoTrafego),
    },
  })
  return { success: true, metric: newMetric }
}

export async function addSaleMetric(value: number) {
  await prisma.dashboardMetric.create({
    data: { vendasQtd: 1, faturamento: Number(value) },
  })
  return { success: true }
}
