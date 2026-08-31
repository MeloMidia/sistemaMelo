'use client'

import { useState } from 'react'
import { UserX } from 'lucide-react'
import { CHURN_REASONS } from '@/lib/clientes'

interface ChurnReasonModalProps {
  clientName: string
  onConfirm: (reason: string) => void
  onCancel: () => void
  isSaving?: boolean
}

export function ChurnReasonModal({ clientName, onConfirm, onCancel, isSaving }: ChurnReasonModalProps) {
  const [reason, setReason] = useState<string>('')
  const [customReason, setCustomReason] = useState('')

  const finalReason = reason === 'Outro' ? customReason.trim() : reason
  const canConfirm = finalReason.length > 0

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-6"
        style={{
          background: 'var(--nm-bg)',
          boxShadow: '-10px -10px 24px var(--nm-light), 10px 10px 24px var(--nm-dark)',
          border: '1px solid var(--nm-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <UserX className="w-4.5 h-4.5 text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-white">Encerrar cliente</h3>
        </div>
        <p className="text-sm text-slate-400 mb-5">
          Qual o motivo da saída de <strong className="text-slate-200">{clientName}</strong>?
        </p>

        <div className="space-y-1.5 mb-4">
          {CHURN_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                reason === r
                  ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                  : 'bg-white/[0.03] text-slate-400 border border-white/[0.06] hover:bg-white/[0.06]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {reason === 'Outro' && (
          <input
            type="text"
            autoFocus
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Descreva o motivo..."
            className="w-full mb-4 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-slate-600 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-500/40"
          />
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => canConfirm && onConfirm(finalReason)}
            disabled={!canConfirm || isSaving}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Confirmar saída
          </button>
        </div>
      </div>
    </div>
  )
}
