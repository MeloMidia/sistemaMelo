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
  novosLeads: number
  agendadas: number
  realizadas: number
  faltas: number
  vendas: number
}

interface DailyLineChartProps {
  data: DayPoint[]
}

type FilterKey = 'all' | 'agendadas' | 'novos-leads' | 'realizadas' | 'faltas' | 'vendas'

const FILTERS: { key: FilterKey; label: string; color: string }[] = [
  { key: 'all',         label: 'Todas',       color: '#6C716E' },
  { key: 'novos-leads', label: 'Novos leads',  color: '#5E82F2' },
  { key: 'agendadas',   label: 'Agendadas',    color: '#2854DF' },
  { key: 'realizadas',  label: 'Realizadas',   color: '#16805D' },
  { key: 'faltas',      label: 'Faltas',       color: '#BC4C4B' },
  { key: 'vendas',      label: 'Vendas',       color: '#C98720' },
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
    'Novos leads': d.novosLeads,
    Agendadas: d.agendadas,
    Realizadas: d.realizadas,
    Faltas: d.faltas,
    Vendas: d.vendas,
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
                      backgroundColor: opt.key === 'all' ? 'var(--mf-well)' : `color-mix(in srgb, ${opt.color} 14%, transparent)`,
                      borderColor: opt.key === 'all' ? 'var(--mf-line)' : `color-mix(in srgb, ${opt.color} 45%, transparent)`,
                      color: opt.key === 'all' ? 'var(--mf-ink)' : opt.color,
                    }
                  : {
                      backgroundColor: 'transparent',
                      borderColor: 'transparent',
                      color: 'var(--mf-muted)',
                    }
              }
            >
              {opt.key !== 'all' && (
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: isActive ? opt.color : 'var(--mf-faint)' }}
                />
              )}
              {opt.label}
            </button>
          )
        })}
      </div>

      {data.length === 0 ? (
          <div className="flex items-center justify-center h-52 text-[#6C716E] text-sm">
          Nenhuma movimentação no período selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="var(--mf-line)"
              horizontal
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--mf-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'var(--mf-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--mf-surface)',
                border: '1px solid var(--mf-line-strong)',
                borderRadius: 10,
                padding: '10px 14px',
                boxShadow: 'var(--mf-shadow-float)',
              }}
              labelStyle={{ color: 'var(--mf-ink)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}
              itemStyle={{ fontSize: 12, color: 'var(--mf-muted)' }}
              cursor={{ stroke: 'var(--mf-signal)', strokeWidth: 1, strokeDasharray: '4 2' }}
            />
            <Legend content={<CustomLegend />} />

            {show('novos-leads') && (
              <Line
                type="monotone"
                dataKey="Novos leads"
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
            {show('vendas') && (
              <Line
                type="monotone"
                dataKey="Vendas"
                stroke="#C98720"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
