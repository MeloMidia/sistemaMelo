'use client'

import { History } from 'lucide-react'
import { useFollowUpLogs } from '@/hooks/crm-api'
import { FOLLOW_UP_COLORS } from './follow-up-column'

interface LeadLogsTabProps {
  leadId: string
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** Histórico de movimentações do lead pelas colunas de Follow Up. */
export function LeadLogsTab({ leadId }: LeadLogsTabProps) {
  const { data: logs = [], isLoading } = useFollowUpLogs(leadId)

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-slate-500">Carregando histórico…</div>
  }

  if (logs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="size-14 rounded-2xl bg-slate-500/10 text-slate-400 flex items-center justify-center mb-4">
          <History className="size-7" />
        </div>
        <h2 className="text-base font-semibold text-white">Nenhuma movimentação registrada</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          Quando este lead entrar ou mudar de coluna no Follow Up, o histórico aparece aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
      {logs.map((log) => {
        const color = log.column ? FOLLOW_UP_COLORS[log.column - 1] : '#64748b'
        return (
          <div key={log.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-white/[0.03] border border-white/[0.06]">
            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-sm font-medium" style={{ color }}>
              {log.column ? `Follow Up — Coluna ${log.column}` : 'Removido do Follow Up'}
            </span>
            <span className="ml-auto text-xs text-slate-500 tabular-nums shrink-0">{formatDateTime(log.createdAt)}</span>
          </div>
        )
      })}
    </div>
  )
}
