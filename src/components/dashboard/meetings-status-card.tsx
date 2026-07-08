'use client'

import { Calendar, CheckCircle2, UserX, XCircle } from 'lucide-react'
import { useAgendaEvents, useUpdateAgendaEvent } from '@/hooks/agenda-api'
import type { AgendaEvent, AgendaEventStatus } from '@/types/agenda'

interface Props {
  start: Date
  end: Date
}

export function MeetingsStatusCard({ start, end }: Props) {
  const { data: events } = useAgendaEvents(start, end)
  const updateEvent = useUpdateAgendaEvent()

  const leadEvents = (events ?? [])
    .filter((e) => e.leadId && e.status !== 'CANCELADA')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  if (leadEvents.length === 0) return null

  function toggle(event: AgendaEvent, next: AgendaEventStatus) {
    updateEvent.mutate({
      id: event.id,
      status: event.status === next ? 'AGENDADA' : next,
    })
  }

  const realizadas = leadEvents.filter((e) => e.status === 'REALIZADA').length

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-orange-400" />
          Reuniões do Período
        </h2>
        <span className="text-[11px] text-orange-400 font-medium uppercase tracking-wider">
          {realizadas}/{leadEvents.length} realizadas
        </span>
      </div>

      <div className="space-y-2">
        {leadEvents.map((event) => {
          const dateStr = new Date(event.startsAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
          const timeStr = new Date(event.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          const isRealizada = event.status === 'REALIZADA'
          const isFalta = event.status === 'FALTA'
          const isNaoRealizada = event.status === 'NAO_REALIZADA'

          return (
            <div
              key={event.id}
              className={`flex items-center justify-between gap-3 border rounded-xl px-4 py-3 transition-all ${
                isRealizada
                  ? 'bg-emerald-500/[0.04] border-emerald-500/20'
                  : isFalta
                    ? 'bg-amber-500/[0.04] border-amber-500/20'
                    : isNaoRealizada
                      ? 'bg-rose-500/[0.04] border-rose-500/20'
                      : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
              }`}
            >
              {/* Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: event.category?.color ?? '#64748b' }}
                />
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${isRealizada ? 'text-slate-400 line-through' : 'text-white'}`}>
                    {event.title}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {dateStr} · {timeStr}
                    {event.lead?.name && ` · ${event.lead.name}`}
                  </p>
                </div>
              </div>

              {/* Botões de status */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => toggle(event, 'REALIZADA')}
                  disabled={updateEvent.isPending}
                  title="Marcar como realizada"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    isRealizada
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Realizada
                </button>
                <button
                  onClick={() => toggle(event, 'FALTA')}
                  disabled={updateEvent.isPending}
                  title="Lead não compareceu (falta)"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    isFalta
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent'
                  }`}
                >
                  <UserX className="w-3 h-3" />
                  Falta
                </button>
                <button
                  onClick={() => toggle(event, 'NAO_REALIZADA')}
                  disabled={updateEvent.isPending}
                  title="Reunião não foi realizada"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    isNaoRealizada
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent'
                  }`}
                >
                  <XCircle className="w-3 h-3" />
                  Não realizada
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
