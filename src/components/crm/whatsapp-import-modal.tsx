'use client'

import { X, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useWaImport } from '@/hooks/crm-api'

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

export function WhatsappImportModal({ onClose }: Props) {
  const imp = useWaImport()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={imp.isPending ? undefined : onClose} />

      <div className="relative bg-[#0d1117] border border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-base">
              💬
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Importar leads do WhatsApp</h2>
              <p className="text-xs text-slate-500">Etiquetas → Kanban CRM</p>
            </div>
          </div>
          {!imp.isPending && (
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {imp.isIdle && (
            <>
              <p className="text-sm text-slate-400 leading-relaxed">
                Importa todos os contatos do WhatsApp Business e sincroniza as etiquetas com os stages do CRM. O processo tem 3 etapas:
              </p>

              <div className="space-y-2.5">
                <Step n={1} label="Importar contatos" desc="Cria leads no CRM a partir dos chats do WA" />
                <Step n={2} label="Sincronizar etiquetas" desc="Varre os 20 labels e atribui stages automaticamente" />
                <Step n={3} label="Atualizar webhook" desc="Habilita sincronização em tempo real para mudanças futuras" />
              </div>

              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 space-y-1.5">
                <MappingRow label="Lead novo, Frio, Não respondeu..." stage="Novo Contato" color="#3b82f6" />
                <MappingRow label="Lead quente, Atendimento, Aula..." stage="Em Conversa" color="#f59e0b" />
                <MappingRow label="Qualificação, Agendou, Negociação" stage="Qualificado" color="#10b981" />
                <MappingRow label="VENDA CONCLUÍDA" stage="Cliente" color="#8b5cf6" />
                <MappingRow label="Faltou na reunião, No realizadas" stage="Perdido" color="#ef4444" />
              </div>
            </>
          )}

          {imp.isPending && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
              <p className="text-sm text-slate-400">Sincronizando etiquetas...</p>
              <p className="text-xs text-slate-600">Isso pode levar 30–60 segundos</p>
            </div>
          )}

          {imp.isSuccess && (() => {
            const r = imp.data as unknown as ImportResult
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-sm font-semibold text-emerald-400">Importação concluída!</span>
                </div>
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 grid grid-cols-2 gap-3 text-center">
                  <StatBox value={r.stagesAssigned} label="Stages atribuídos" accent="#10b981" />
                  <StatBox value={r.tagsApplied} label="Tags aplicadas" accent="#8b5cf6" />
                  <StatBox value={r.chatsImported} label="Leads criados" accent="#3b82f6" />
                  <StatBox value={r.chatsAlreadyExisted} label="Já existiam" accent="#64748b" />
                </div>
                <div className="space-y-1.5">
                  <StatusLine ok={r.webhookUpdated} label="Webhook ativo para mudanças futuras de etiqueta" />
                </div>
              </div>
            )
          })()}

          {imp.isError && (
            <div className="flex items-start gap-2 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span className="text-sm">{(imp.error as Error).message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 pt-0">
          {imp.isSuccess ? (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Fechar
            </button>
          ) : imp.isError ? (
            <>
              <button onClick={() => imp.reset()} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-sm font-medium transition-colors cursor-pointer">
                Tentar novamente
              </button>
              <button onClick={onClose} className="py-2.5 px-4 rounded-xl text-slate-500 hover:text-white text-sm font-medium transition-colors cursor-pointer">
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => imp.mutate()}
                disabled={imp.isPending}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {imp.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Sincronizando...</>
                ) : (
                  <><Download className="w-4 h-4" />Iniciar importação</>
                )}
              </button>
              <button onClick={onClose} disabled={imp.isPending} className="py-2.5 px-4 rounded-xl text-slate-500 hover:text-white disabled:opacity-50 text-sm font-medium transition-colors cursor-pointer">
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Step({ n, label, desc }: { n: number; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0 mt-0.5">
        {n}
      </div>
      <div>
        <p className="text-xs font-medium text-white">{label}</p>
        <p className="text-[11px] text-slate-500">{desc}</p>
      </div>
    </div>
  )
}

function MappingRow({ label, stage, color }: { label: string; stage: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-500 flex-1 truncate">{label}</span>
      <span className="text-slate-600 shrink-0">→</span>
      <span className="px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: `${color}26`, color }}>
        {stage}
      </span>
    </div>
  )
}

function StatBox({ value, label, accent }: { value: number; label: string; accent?: string }) {
  return (
    <div>
      <p className="text-2xl font-bold tabular-nums" style={{ color: accent ?? 'white' }}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}

function StatusLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${ok ? 'text-emerald-400' : 'text-slate-600'}`} />
      <span className={ok ? 'text-slate-400' : 'text-slate-600'}>{label}</span>
    </div>
  )
}
