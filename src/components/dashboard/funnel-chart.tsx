'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface FunnelChartProps {
  novosLeads: number
  agendadas: number
  realizadas: number
  vendas: number
}

const COLORS = ['#277C91', '#4A9B8F', '#8ABFA2', '#B7791F']

export function FunnelChart({ novosLeads, agendadas, realizadas, vendas }: FunnelChartProps) {
  const data = [
    { name: 'Novos leads', value: novosLeads },
    { name: 'Agendadas', value: agendadas },
    { name: 'Realizadas', value: realizadas },
    { name: 'Vendas', value: vendas },
  ]

  if (novosLeads === 0 && agendadas === 0 && realizadas === 0 && vendas === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-slate-500 text-sm">
        Nenhum dado no período
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart layout="vertical" data={data} margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={82}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          contentStyle={{
            background: '#0f111a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
          }}
          labelStyle={{ color: '#e2e8f0', fontSize: 12 }}
          itemStyle={{ color: '#94a3b8', fontSize: 12 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [value, '']}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#94a3b8', fontSize: 12 }}>
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
