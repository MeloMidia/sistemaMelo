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
  { key: 'all',       label: 'Todas',      color: '#6C716E' },
  { key: 'agendadas', label: 'Agendadas',  color: '#2854DF' },
  { key: 'leadswa',   label: 'Leads WA',   color: '#5E82F2' },
  { key: 'realizadas',label: 'Realizadas', color: '#16805D' },
  { key: 'faltas',    label: 'Faltas',     color: '#BC4C4B' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLegend({ payload }: any) {
  return (
    <div className="flex items-center justify-center gap-6 pt-3 pb-1">
      {payload?.map((entry: { color: string; value: string }, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-[#526158]">{entry.value}</span>
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
                      backgroundColor: opt.key === 'all' ? '#F2F3F0' : `${opt.color}18`,
                      borderColor: opt.key === 'all' ? '#E6E8E3' : `${opt.color}50`,
                      color: opt.key === 'all' ? '#151817' : opt.color,
                    }
                  : {
                      backgroundColor: 'transparent',
                      borderColor: 'transparent',
                      color: '#6C716E',
                    }
              }
            >
              {opt.key !== 'all' && (
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: isActive ? opt.color : '#C5C9C5' }}
                />
              )}
              {opt.label}
            </button>
          )
        })}
      </div>

      {data.length === 0 ? (
          <div className="flex items-center justify-center h-52 text-[#6C716E] text-sm">
          Nenhum lançamento no período selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="#E6E8E3"
              horizontal
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: '#6C716E', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#6C716E', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: '#FFFFFF',
                border: '1px solid #E6E8E3',
                borderRadius: 10,
                padding: '10px 14px',
                boxShadow: '0 12px 28px rgba(23,49,40,0.10)',
              }}
              labelStyle={{ color: '#151817', fontSize: 12, fontWeight: 600, marginBottom: 6 }}
              itemStyle={{ fontSize: 12, color: '#6C716E' }}
              cursor={{ stroke: '#B8C7FA', strokeWidth: 1, strokeDasharray: '4 2' }}
            />
            <Legend content={<CustomLegend />} />

            {show('leadswa') && (
              <Line
                type="monotone"
                dataKey="Leads WA"
                stroke="#5E82F2"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
            {show('agendadas') && (
              <Line
                type="monotone"
                dataKey="Agendadas"
                stroke="#2854DF"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
            {show('realizadas') && (
              <Line
                type="monotone"
                dataKey="Realizadas"
                stroke="#16805D"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
            {show('faltas') && (
              <Line
                type="monotone"
                dataKey="Faltas"
                stroke="#BC4C4B"
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
