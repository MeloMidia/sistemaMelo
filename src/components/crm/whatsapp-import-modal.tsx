'use client'

import { useState } from 'react'
import { X, Download, CheckCircle, AlertCircle, Loader2, Trash2, Webhook } from 'lucide-react'
import { useWaImport, useCleanupLidLeads } from '@/hooks/crm-api'

interface Props {
  onClose: () => void
}

interface ImportResult {
  chatsImported: number
  chatsAlreadyExisted: number
  totalChats: number
  stagesAssigned: number
  tagsApplied: number
  webhookUpdated: boolean
  labels: number
}

interface CleanupResult {
  deleted: number
  skipped: number
}

export function WhatsappImportModal({ onClose }: Props) {
  const imp = useWaImport()
  const cleanup = useCleanupLidLeads()
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null)
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [webhookMsg, setWebhookMsg] = useState('')

  async function configureWebhook() {
    setWebhookStatus('loading')
    try {
      const res = await fetch('/api/crm/webhook/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok) {
        setWebhookStatus('ok')
        setWebhookMsg('Webhook configurado com sucesso!')
      } else {
        setWebhookStatus('error')
        setWebhookMsg(data.error ?? `Erro ${res.status}`)
      }
    } catch {
      setWebhookStatus('error')
      setWebhookMsg('Falha ao configurar webhook')
    }
  }

  const isPending = imp.isPending || cleanup.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={isPending ? undefined : onClose} />

      <div className="relative bg-[#0d1117] border border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-base">
              💬
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Sincronizar WhatsApp</h2>
              <p className="text-xs text-slate-500">Etiquetas · Contatos · Webhook</p>
            </div>
          </div>
          {!isPending && (
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">

          {/* ── Importar WA ──────────────────────────────────── */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-semibold text-white">1. Importar contatos e etiquetas</p>
                <p className="text-xs text-slate-500 mt-0.5">Sincroniza todos os contatos do WhatsApp e atribui stages automaticamente</p>
              </div>
              <button
                onClick={() => imp.mutate()}
                disabled={isPending || imp.isSuccess}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {imp.isPending ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Sincronizando...</>
                ) : imp.isSuccess ? (
                  <><CheckCircle className="w-3 h-3" />Feito</>
                ) : (
                  <><Download className="w-3 h-3" />Importar</>
                )}
              </button>
            </div>

            {imp.isSuccess && (() => {
              const r = imp.data as unknown as ImportResult
              return (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <StatBox value={r.chatsImported} label="Criados" accent="#10b981" />
                  <StatBox value={r.stagesAssigned} label="Stages" accent="#8b5cf6" />
                  <StatBox value={r.tagsApplied} label="Etiquetas" accent="#3b82f6" />
                </div>
              )
            })()}

            {imp.isError && (
              <div className="flex items-start gap-2 text-rose-400 text-xs mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{(imp.error as Error).message}</span>
              </div>
            )}
          </div>

          {/* ── Configurar Webhook ─────────────────────────── */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">2. Ativar mensagens em tempo real</p>
                <p className="text-xs text-slate-500 mt-0.5">Configura o webhook para novas mensagens e contatos aparecerem automaticamente</p>
              </div>
              <button
                onClick={configureWebhook}
                disabled={isPending || webhookStatus === 'loading' || webhookStatus === 'ok'}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {webhookStatus === 'loading' ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Configurando...</>
                ) : webhookStatus === 'ok' ? (
                  <><CheckCircle className="w-3 h-3" />Ativo</>
                ) : (
                  <><Webhook className="w-3 h-3" />Configurar</>
                )}
              </button>
            </div>
            {webhookMsg && (
              <p className={`text-xs mt-2 ${webhookStatus === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {webhookMsg}
              </p>
            )}
          </div>

          {/* ── Limpar fantasmas ──────────────────────────── */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">3. Limpar contatos fantasma</p>
                <p className="text-xs text-slate-500 mt-0.5">Remove leads com número irresolúvel (lid:…) que nunca trocaram mensagem</p>
              </div>
              <button
                onClick={() => cleanup.mutate(undefined, { onSuccess: (d) => setCleanupResult(d) })}
                disabled={isPending || cleanup.isSuccess}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {cleanup.isPending ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Limpando...</>
                ) : cleanup.isSuccess ? (
                  <><CheckCircle className="w-3 h-3" />Feito</>
                ) : (
                  <><Trash2 className="w-3 h-3" />Limpar</>
                )}
              </button>
            </div>
            {cleanupResult && (
              <p className="text-xs text-emerald-400 mt-2">
                {cleanupResult.deleted} contatos fantasma removidos
                {cleanupResult.skipped > 0 ? ` · ${cleanupResult.skipped} mantidos (têm mensagens)` : ''}
              </p>
            )}
            {cleanup.isError && (
              <p className="text-xs text-rose-400 mt-2">{(cleanup.error as Error).message}</p>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 pt-0">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

function StatBox({ value, label, accent }: { value: number; label: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] py-2">
      <p className="text-xl font-bold tabular-nums" style={{ color: accent ?? 'white' }}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}
