'use client'

import { useState } from 'react'
import { X, Check, Loader2, TriangleAlert } from 'lucide-react'
import { useUpdateLead } from '@/hooks/crm-api'
import type { DashboardData } from '@/hooks/api'

type Sale = DashboardData['sales'][number]

function formatMoney(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(value: Date | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function SaleRow({ sale }: { sale: Sale }) {
  const updateLead = useUpdateLead()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(sale.value != null ? String(sale.value) : '')
  const hasValue = typeof sale.value === 'number' && Number.isFinite(sale.value) && sale.value > 0

  function save() {
    const parsed = parseFloat(draft.replace(',', '.'))
    const nextValue = Number.isFinite(parsed) && parsed > 0 ? parsed : null
    setEditing(false)
    if (nextValue === sale.value) return
    updateLead.mutate({ id: sale.id, value: nextValue })
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${
        hasValue ? 'border-[#EDF0EB] bg-white' : 'border-[#F3D9A8] bg-[#FFF9EE]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#151817]">{sale.name || 'Sem nome'}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#8A8F89]">
          {formatDate(sale.closedAt)}
          {!hasValue && (
            <span className="inline-flex items-center gap-1 font-medium text-[#9A5B16]">
              <TriangleAlert className="h-3 w-3" /> Sem valor
            </span>
          )}
        </p>
      </div>

      {editing ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-sm text-[#6C716E]">R$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') setEditing(false)
            }}
            onBlur={save}
            placeholder="0,00"
            className="h-8 w-28 rounded-lg border border-[#2854DF]/40 bg-white px-2 text-right text-sm text-[#151817] outline-none focus:border-[#2854DF] focus:ring-1 focus:ring-[#2854DF]/30"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={save}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#2854DF] text-white transition-colors hover:bg-[#1f43b8]"
            title="Salvar"
          >
            {updateLead.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setDraft(sale.value != null ? String(sale.value) : ''); setEditing(true) }}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors ${
            hasValue
              ? 'text-[#151817] hover:bg-[#F2F3F0]'
              : 'bg-[#F6B24A]/15 text-[#9A5B16] hover:bg-[#F6B24A]/25'
          }`}
        >
          {hasValue ? formatMoney(sale.value as number) : 'Adicionar valor'}
        </button>
      )}
    </div>
  )
}

export function SalesEditModal({ sales, onClose }: { sales: Sale[]; onClose: () => void }) {
  const withoutValueCount = sales.filter((s) => !(typeof s.value === 'number' && s.value > 0)).length

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#EDF0EB] p-5">
          <div>
            <h3 className="text-base font-semibold text-[#151817]">Vendas do período</h3>
            <p className="mt-0.5 text-xs text-[#6C716E]">
              {sales.length} venda(s){withoutValueCount > 0 && ` · ${withoutValueCount} sem valor`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#6C716E] transition-colors hover:bg-[#F2F3F0] hover:text-[#151817]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {sales.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#6C716E]">Nenhuma venda fechada nesse período.</p>
          ) : (
            sales.map((sale) => <SaleRow key={sale.id} sale={sale} />)
          )}
        </div>
      </div>
    </div>
  )
}
