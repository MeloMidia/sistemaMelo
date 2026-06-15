'use client'

import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { formatDateLabel } from '@/lib/date-range'

interface DayPoint {
  date: Date | string
  leadsWhatsapp: number
  agendadas: number
  realizadas: number
}

interface DailyLineChartProps {
  data: DayPoint[]
}

export function DailyLineChart({ data }: DailyLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-slate-500 text-sm">
        Nenhum lançamento no período selecionado
      </div>
    )
  }

  const chartData = data.map(d => ({
    date: formatDateLabel(d.date),
    'Leads WA': d.leadsWhatsapp,
    Agendadas: d.agendadas,
    Realizadas: d.realizadas,
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: '#0f111a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
          }}
          labelStyle={{ color: '#e2e8f0', fontSize: 12 }}
          itemStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }} />
        <Line type="monotone" dataKey="Leads WA" stroke="#6366f1" strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="Agendadas"
          stroke="#818cf8"
          strokeWidth={2}
          strokeDasharray="4 2"
          dot={false}
        />
        <Line type="monotone" dataKey="Realizadas" stroke="#10b981" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
