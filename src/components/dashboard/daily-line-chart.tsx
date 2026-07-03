'use client'

import React, { useState } from 'react'
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
  naoRealizada: number
}

interface DailyLineChartProps {
  data: DayPoint[]
}

type FilterKey = 'all' | 'agendadas' | 'leadswa' | 'realizadas' | 'faltas'

const FILTERS: { key: FilterKey; label: string; color: string }[] = [
  { key: 'all',       label: 'Todas',      color: '#94a3b8' },
  { key: 'agendadas', label: 'Agendadas',  color: '#06c5b2' },
  { key: 'leadswa',   label: 'Leads WA',   color: '#e91e8c' },
  { key: 'realizadas',label: 'Realizadas', color: '#7c4dff' },
  { key: 'faltas',    label: 'Faltas',     color: '#f43f5e' },
]

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
  const [filter, setFilter] = useState<FilterKey>('all')

  const chartData = data.map(d => ({
    date: formatDateLabel(d.date),
    'Leads WA': d.leadsWhatsapp,
    Agendadas: d.agendadas,
    Realizadas: d.realizadas,
    Faltas: d.naoRealizada,
  }))

  const show = (key: FilterKey) => filter === 'all' || filter === key

  return (
    <div>
      {/* Filter pills */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {FILTERS.map(opt => {
          const isActive = filter === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border"
              style={
                isActive
                  ? {
                      backgroundColor: opt.key === 'all' ? 'rgba(255,255,255,0.08)' : `${opt.color}18`,
                      borderColor: opt.key === 'all' ? 'rgba(255,255,255,0.15)' : `${opt.color}50`,
                      color: opt.key === 'all' ? '#e2e8f0' : opt.color,
                    }
                  : {
                      backgroundColor: 'transparent',
                      borderColor: 'transparent',
                      color: '#64748b',
                    }
              }
            >
              {opt.key !== 'all' && (
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: isActive ? opt.color : '#475569' }}
                />
              )}
              {opt.label}
            </button>
          )
        })}
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-52 text-slate-500 text-sm">
          Nenhum lançamento no período selecionado
        </div>
      ) : (
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

            {show('leadswa') && (
              <Line
                type="monotone"
                dataKey="Leads WA"
                stroke="#e91e8c"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
            {show('agendadas') && (
              <Line
                type="monotone"
                dataKey="Agendadas"
                stroke="#06c5b2"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
            {show('realizadas') && (
              <Line
                type="monotone"
                dataKey="Realizadas"
                stroke="#7c4dff"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
            {show('faltas') && (
              <Line
                type="monotone"
                dataKey="Faltas"
                stroke="#f43f5e"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                strokeDasharray="5 3"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
