'use client'

import { useState } from 'react'
import { Loader2, RotateCcw, X } from 'lucide-react'
import { setRevenueOverride } from '@/app/actions/metrics'

function formatMoney(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function RevenueOverrideModal({
  start,
  end,
  revenue,
  revenueAuto,
  revenueOverridden,
  onClose,
  onSaved,
}: {
  start: Date
  end: Date
  revenue: number
  revenueAuto: number
  revenueOverridden: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [value, setValue] = useState(String(revenue))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const parsed = parseFloat(value.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Informe um valor válido.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await setRevenueOverride(start, end, parsed)
      onSaved()
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  async function reset() {
    setSaving(true)
    setError(null)
    try {
      await setRevenueOverride(start, end, null)
      onSaved()
      onClose()
    } catch {
      setError('Não foi possível voltar ao cálculo automático. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-[#151817]">Editar faturamento confirmado</h3>
            <p className="mt-1 text-xs text-[#6C716E]">
              Ajusta manualmente o valor exibido pro período selecionado, sem alterar as vendas no CRM.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#6C716E] transition-colors hover:bg-[#F2F3F0] hover:text-[#151817]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6C716E]">Valor (R$)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          className="w-full rounded-xl border border-[#2854DF]/40 bg-white px-3.5 py-2.5 text-lg font-semibold text-[#151817] outline-none focus:border-[#2854DF] focus:ring-1 focus:ring-[#2854DF]/30"
        />
        {error && <p className="mt-1.5 text-xs text-[#BC4C4B]">{error}</p>}

        <p className="mt-2 text-xs text-[#8A8F89]">
          Soma automática das vendas fechadas do período: <strong className="font-semibold text-[#526158]">{formatMoney(revenueAuto)}</strong>
        </p>

        <div className="mt-5 flex items-center gap-2">
          {revenueOverridden && (
            <button
              onClick={reset}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-[#6C716E] transition-colors hover:bg-[#F2F3F0] hover:text-[#151817] disabled:opacity-40"
              title="Voltar a calcular automaticamente a partir das vendas fechadas"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Usar automático
            </button>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-[#2854DF] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1f43b8] disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
