'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import { upsertSdrLog, getSdrLogByDate } from '@/app/actions/sdr'
import { addDashboardMetric } from '@/app/actions/metrics'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  currentFaturamento: number
  currentVendasQtd: number
}

function Field({
  label,
  value,
  onChange,
  prefix,
  step = 1,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  prefix?: string
  step?: number
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">{prefix}</span>
        )}
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-white/[0.04] border border-white/[0.08] rounded-lg py-2.5 text-white text-sm outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${prefix ? 'pl-9 pr-3' : 'px-3'}`}
        />
      </div>
    </div>
  )
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function EditMetricsModal({ open, onClose, onSaved, currentFaturamento, currentVendasQtd }: Props) {
  const [date, setDate] = useState(todayStr())
  const [faturamento, setFaturamento] = useState(String(currentFaturamento))
  const [vendas, setVendas] = useState(String(currentVendasQtd))
  const [leadsWa, setLeadsWa] = useState('0')
  const [agendadas, setAgendadas] = useState('0')
  const [realizadas, setRealizadas] = useState('0')
  const [saving, setSaving] = useState(false)
  const [loadingLog, setLoadingLog] = useState(false)

  useEffect(() => {
    if (!open) return
    setFaturamento(String(currentFaturamento))
    setVendas(String(currentVendasQtd))
    setDate(todayStr())
  }, [open, currentFaturamento, currentVendasQtd])

  useEffect(() => {
    if (!open) return
    setLoadingLog(true)
    const d = new Date(date + 'T12:00:00')
    getSdrLogByDate(d).then((log) => {
      setLeadsWa(String(log?.leadsWhatsapp ?? 0))
      setAgendadas(String(log?.agendadas ?? 0))
      setRealizadas(String(log?.realizadas ?? 0))
      setLoadingLog(false)
    })
  }, [date, open])

  async function handleSave() {
    setSaving(true)
    try {
      const d = new Date(date + 'T12:00:00')
      const existing = await getSdrLogByDate(d)

      await upsertSdrLog(d, {
        leadsWhatsapp: parseInt(leadsWa) || 0,
        agendadas: parseInt(agendadas) || 0,
        realizadas: parseInt(realizadas) || 0,
        faltaLead: existing?.faltaLead ?? 0,
        naoRealizada: existing?.naoRealizada ?? 0,
      })

      const fatVal = parseFloat(faturamento.replace(',', '.')) || 0
      const vendasVal = parseInt(vendas) || 0
      const fatDelta = fatVal - currentFaturamento
      const vendasDelta = vendasVal - currentVendasQtd

      if (fatDelta !== 0 || vendasDelta !== 0) {
        await addDashboardMetric({
          leadsTrafego: 0,
          leadsIndicacao: 0,
          reunioesAgendadas: 0,
          reunioesRealizadas: 0,
          vendasQtd: vendasDelta,
          faturamento: fatDelta,
          investimentoTrafego: 0,
        })
      }

      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[#0d0f1a] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">Editar métricas</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.06] text-slate-500 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors [color-scheme:dark]"
            />
          </div>

          <div className="h-px bg-white/[0.05]" />

          {/* SDR fields */}
          <div>
            <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider mb-3">SDR — dia selecionado</p>
            {loadingLog ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Carregando dados do dia...
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <Field label="Leads WA" value={leadsWa} onChange={setLeadsWa} />
                <Field label="Agendadas" value={agendadas} onChange={setAgendadas} />
                <Field label="Realizadas" value={realizadas} onChange={setRealizadas} />
              </div>
            )}
          </div>

          <div className="h-px bg-white/[0.05]" />

          {/* Sales fields */}
          <div>
            <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider mb-3">Vendas — total do período</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Faturamento" value={faturamento} onChange={setFaturamento} prefix="R$" step={0.01} />
              <Field label="Vendas" value={vendas} onChange={setVendas} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-400 hover:text-white text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
