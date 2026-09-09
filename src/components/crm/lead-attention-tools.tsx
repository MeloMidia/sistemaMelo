'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Clock3, CopyCheck, Loader2, MessageCircle, Merge, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  useDuplicateLeadGroups,
  useMergeLeads,
  useUnansweredLeadAlerts,
  type DuplicateLeadGroup,
  type UnansweredLeadAlert,
} from '@/hooks/crm-api'
import { formatPhoneNumber, getLeadDisplayName } from '@/lib/phone'

type AttentionDialog = 'unanswered' | 'duplicates' | null

function elapsed(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
  if (minutes < 60) return `${Math.max(minutes, 1)} min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h atrás`
  return `${Math.floor(hours / 24)} d atrás`
}

function AlertLeadRow({ lead, onOpen }: { lead: UnansweredLeadAlert; onOpen: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--mf-line)] px-5 py-3 last:border-b-0">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--mf-warning-soft)] text-sm font-semibold text-[var(--mf-warning)]">
        {getLeadDisplayName(lead).slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-[var(--mf-ink)]">{getLeadDisplayName(lead)}</p>
          <span className="shrink-0 text-[10px] text-[var(--mf-warning)]">{elapsed(lead.lastMessage.createdAt)}</span>
        </div>
        <p className="truncate text-xs text-[var(--mf-muted)]">{lead.lastMessage.content}</p>
        <p className="mt-0.5 text-[10px] text-[var(--mf-faint)]">
          {lead.stage?.name ?? 'Sem etapa'}{lead.assignedTo ? ` · ${lead.assignedTo.name}` : ' · Sem responsável'}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onOpen} title="Abrir conversa">
        <MessageCircle className="size-3.5" />
        Abrir
      </Button>
    </div>
  )
}

function DuplicateGroup({
  group,
  keepId,
  onKeepChange,
  onMerge,
}: {
  group: DuplicateLeadGroup
  keepId: string
  onKeepChange: (id: string) => void
  onMerge: (group: DuplicateLeadGroup, mergeId: string) => void
}) {
  const mergeId = group.leads.find((lead) => lead.id !== keepId)?.id
  return (
    <div className="border-b border-[var(--mf-line)] p-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--mf-ink)]">Telefone repetido</p>
          <p className="text-[11px] text-[var(--mf-muted)]">{formatPhoneNumber(group.key)}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!mergeId}
          onClick={() => mergeId && onMerge(group, mergeId)}
          title="Mesclar registros duplicados"
        >
          <Merge className="size-3.5" />
          Mesclar
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {group.leads.map((lead) => (
          <label
            key={lead.id}
            className={`flex cursor-pointer gap-2 rounded-lg border p-3 transition-colors ${keepId === lead.id ? 'border-[var(--mf-signal)] bg-[var(--mf-signal-soft)]' : 'border-[var(--mf-line)] hover:bg-[var(--mf-well)]'}`}
          >
            <input
              type="radio"
              name={`keep-${group.key}`}
              checked={keepId === lead.id}
              onChange={() => onKeepChange(lead.id)}
              className="mt-0.5 accent-[var(--mf-signal)]"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-[var(--mf-ink)]">{getLeadDisplayName(lead)}</span>
              <span className="block text-[11px] text-[var(--mf-muted)]">{formatPhoneNumber(lead.phone)}</span>
              <span className="mt-1 block text-[10px] text-[var(--mf-faint)]">
                {lead._count.messages} mensagens · {lead._count.tasks} tarefas
              </span>
              {keepId === lead.id && <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--mf-success)]"><Check className="size-3" /> Manter este</span>}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

export function LeadAttentionTools({ onOpenLead }: { onOpenLead: (leadId: string) => void }) {
  const [dialog, setDialog] = useState<AttentionDialog>(null)
  const [keepByGroup, setKeepByGroup] = useState<Record<string, string>>({})
  const [pendingMerge, setPendingMerge] = useState<{ group: DuplicateLeadGroup; keepId: string; mergeId: string } | null>(null)
  const unanswered = useUnansweredLeadAlerts(true)
  const duplicates = useDuplicateLeadGroups(dialog === 'duplicates')
  const mergeLeads = useMergeLeads()

  const duplicateCount = duplicates.data?.total ?? 0
  const unansweredCount = unanswered.data?.total ?? 0
  const pendingKeepName = useMemo(
    () => pendingMerge?.group.leads.find((lead) => lead.id === pendingMerge.keepId),
    [pendingMerge],
  )

  function openLead(leadId: string) {
    setDialog(null)
    onOpenLead(leadId)
  }

  function requestMerge(group: DuplicateLeadGroup, mergeId: string) {
    setPendingMerge({ group, keepId: keepByGroup[group.key] ?? group.leads[0].id, mergeId })
  }

  function confirmMerge() {
    if (!pendingMerge) return
    mergeLeads.mutate(pendingMerge, {
      onSuccess: () => setPendingMerge(null),
    })
  }

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          className="justify-between border-[var(--mf-line)] bg-[var(--mf-surface)] text-[var(--mf-ink)]"
          onClick={() => setDialog('unanswered')}
          title="Ver leads aguardando resposta"
        >
          <span className="flex min-w-0 items-center gap-1.5"><Clock3 className="size-3.5 text-[var(--mf-warning)]" /> <span className="truncate">Sem resposta</span></span>
          {unansweredCount > 0 && <span className="tabular-nums text-[10px] font-semibold text-[var(--mf-warning)]">{unansweredCount}</span>}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="justify-between border-[var(--mf-line)] bg-[var(--mf-surface)] text-[var(--mf-ink)]"
          onClick={() => setDialog('duplicates')}
          title="Ver leads duplicados"
        >
          <span className="flex min-w-0 items-center gap-1.5"><CopyCheck className="size-3.5 text-[var(--mf-signal)]" /> <span className="truncate">Duplicados</span></span>
          {duplicateCount > 0 && <span className="tabular-nums text-[10px] font-semibold text-[var(--mf-signal)]">{duplicateCount}</span>}
        </Button>
      </div>

      <Dialog open={dialog === 'unanswered'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="mf-pipeline-dialog max-h-[min(720px,calc(100vh-2rem))] overflow-hidden p-0 sm:max-w-[620px]">
          <DialogHeader className="mf-pipeline-dialog-header">
            <div>
              <DialogTitle>Leads sem resposta</DialogTitle>
              <DialogDescription>Mensagens recebidas há pelo menos 24 horas sem resposta enviada.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="max-h-[480px] overflow-y-auto">
            {unanswered.isLoading && <div className="flex items-center justify-center gap-2 p-10 text-sm text-[var(--mf-muted)]"><Loader2 className="size-4 animate-spin" /> Carregando alertas...</div>}
            {unanswered.isError && <div className="p-8 text-center text-sm text-[var(--mf-danger)]">{unanswered.error.message}</div>}
            {unanswered.data?.items.length === 0 && <div className="p-10 text-center"><Check className="mx-auto mb-2 size-7 text-[var(--mf-success)]" /><p className="text-sm font-medium text-[var(--mf-ink)]">Tudo em dia</p><p className="mt-1 text-xs text-[var(--mf-muted)]">Nenhum lead está aguardando resposta.</p></div>}
            {unanswered.data?.items.map((lead) => <AlertLeadRow key={lead.id} lead={lead} onOpen={() => openLead(lead.id)} />)}
          </div>
          {unanswered.data?.hasMore && <p className="border-t border-[var(--mf-line)] px-5 py-3 text-[11px] text-[var(--mf-muted)]">Mostrando os primeiros 50 alertas. Priorize os mais antigos.</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'duplicates'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="mf-pipeline-dialog max-h-[min(760px,calc(100vh-2rem))] overflow-hidden p-0 sm:max-w-[680px]">
          <DialogHeader className="mf-pipeline-dialog-header">
            <div>
              <DialogTitle>Mesclar leads duplicados</DialogTitle>
              <DialogDescription>Escolha qual registro será mantido. Mensagens e vínculos dos demais serão transferidos.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="max-h-[520px] overflow-y-auto">
            {duplicates.isLoading && <div className="flex items-center justify-center gap-2 p-10 text-sm text-[var(--mf-muted)]"><Loader2 className="size-4 animate-spin" /> Procurando duplicados...</div>}
            {duplicates.isError && <div className="p-8 text-center text-sm text-[var(--mf-danger)]">{duplicates.error.message}</div>}
            {duplicates.data?.groups.length === 0 && <div className="p-10 text-center"><Users className="mx-auto mb-2 size-7 text-[var(--mf-success)]" /><p className="text-sm font-medium text-[var(--mf-ink)]">Nenhum duplicado encontrado</p><p className="mt-1 text-xs text-[var(--mf-muted)]">A busca considera telefones normalizados.</p></div>}
            {duplicates.data?.groups.map((group) => <DuplicateGroup key={group.key} group={group} keepId={keepByGroup[group.key] ?? group.leads[0].id} onKeepChange={(id) => setKeepByGroup((current) => ({ ...current, [group.key]: id }))} onMerge={requestMerge} />)}
          </div>
          {duplicates.data?.truncated && <p className="border-t border-[var(--mf-line)] px-5 py-3 text-[11px] text-[var(--mf-warning)]">A busca foi limitada aos 5.000 leads mais antigos por telefone.</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingMerge} onOpenChange={(open) => !open && !mergeLeads.isPending && setPendingMerge(null)}>
        <DialogContent className="mf-pipeline-dialog sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Confirmar mesclagem?</DialogTitle>
            <DialogDescription>
              O registro de <strong>{pendingKeepName ? getLeadDisplayName(pendingKeepName) : 'destino'}</strong> será mantido. O outro lead será excluído depois que seus dados forem transferidos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-lg bg-[var(--mf-warning-soft)] p-3 text-xs text-[var(--mf-warning)]"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> Essa ação não deve ser repetida para o mesmo grupo.</div>
          {mergeLeads.isError && <p className="text-xs text-[var(--mf-danger)]" role="alert">{mergeLeads.error.message}</p>}
          <DialogFooter className="mf-pipeline-dialog-footer">
            <Button variant="ghost" onClick={() => setPendingMerge(null)} disabled={mergeLeads.isPending}><X className="size-3.5" /> Cancelar</Button>
            <Button onClick={confirmMerge} disabled={mergeLeads.isPending}><Merge className="size-3.5" /> {mergeLeads.isPending ? 'Mesclando...' : 'Confirmar mesclagem'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
