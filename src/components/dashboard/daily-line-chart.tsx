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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLegend({ payload }: any) {
  return (
    <div className="flex items-center justify-center gap-6 pt-3 pb-1">
      {payload?.map((entry: { color: string; value: string }, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-slate-400">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function DailyLineChart({ data }: DailyLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-52 text-slate-500 text-sm">
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
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="rgba(255,255,255,0.06)"
          horizontal
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: '#111827',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '10px 14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
          labelStyle={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, marginBottom: 6 }}
          itemStyle={{ fontSize: 12, color: '#94a3b8' }}
          cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 2' }}
        />
        <Legend content={<CustomLegend />} />
        <Line
          type="monotone"
          dataKey="Leads WA"
          stroke="#e91e8c"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="Agendadas"
          stroke="#06c5b2"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="Realizadas"
          stroke="#7c4dff"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
