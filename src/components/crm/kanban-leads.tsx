'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  CalendarDays,
  CheckCheck,
  CirclePlus,
  Filter,
  GripVertical,
  LayoutDashboard,
  Loader2,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  Check,
} from 'lucide-react'
import { useCreateLead, useCreateStage, useDeleteLead, useMoveAllLeads, useStages, useUpdateLead, useUpdateStage } from '@/hooks/crm-api'
import type { Lead, LeadStage } from '@/types/crm'
import { formatPhoneNumber, getLeadDisplayName } from '@/lib/phone'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { CreateCampaignForm } from '@/components/crm/campaigns-view'

const STAGE_SWATCHES = ['#2f855a', '#3b6fd8', '#8b5cf6', '#d6922e', '#c45b3c', '#15724f']

type ActivityFilter = 'all' | 'unread' | 'active'

/** Colunas "Follow Up 1", "Follow-up 2"… ganham o botão de disparo em massa. */
function isFollowUpStage(name: string) {
  return name.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g, '').startsWith('followup')
}

function timeAgo(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime())
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d`
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(value))
}

function getPreview(lead: Lead) {
  const content = lead.messages[0]?.content
  if (!content) return 'Aguardando primeira conversa'
  if (content.startsWith('[midia')) return 'Mídia compartilhada'
  return content
}

function hasUnreadMessage(lead: Lead) {
  const latest = lead.messages[0]
  return Boolean(
    latest?.direction === 'INBOUND' &&
    (!lead.lastReadAt || new Date(latest.createdAt) > new Date(lead.lastReadAt))
  )
}

function LeadAvatar({ lead }: { lead: Lead }) {
  const name = getLeadDisplayName(lead)

  return (
    <div className="mf-pipeline-avatar" aria-hidden="true">
      <span>{name.slice(0, 1).toUpperCase()}</span>
      {lead.profilePicUrl && (
        // URLs de foto do WhatsApp não são estáveis o bastante para next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lead.profilePicUrl} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />
      )}
    </div>
  )
}

function PipelineCard({
  lead,
  isOverlay = false,
  onOpenLead,
  onRequestDelete,
}: {
  lead: Lead
  isOverlay?: boolean
  onOpenLead: (leadId: string) => void
  onRequestDelete: (lead: Lead) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lead:${lead.id}`,
    data: { type: 'lead', lead },
    disabled: isOverlay,
  })
  const unread = hasUnreadMessage(lead)
  const latest = lead.messages[0]

  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => !isOverlay && onOpenLead(lead.id)}
      className={`mf-pipeline-card ${isDragging ? 'is-dragging' : ''} ${isOverlay ? 'is-overlay' : ''}`}
      aria-label={`Abrir lead ${getLeadDisplayName(lead)}`}
    >
      <div className="mf-pipeline-card-top">
        <GripVertical className="mf-pipeline-grip" aria-hidden="true" />
        <LeadAvatar lead={lead} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="mf-pipeline-card-name truncate">{getLeadDisplayName(lead)}</h3>
            {unread && <span className="mf-pipeline-unread-dot" aria-label="Nova mensagem" />}
          </div>
          <p className="mf-pipeline-card-phone">{formatPhoneNumber(lead.phone)}</p>
        </div>
        {!isOverlay && (
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className="mf-pipeline-icon-button"
              aria-label={`Mais opções de ${getLeadDisplayName(lead)}`}
              title="Ações do lead"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem onClick={() => onOpenLead(lead.id)}>
                <MessageCircle className="size-4" aria-hidden="true" />
                Abrir conversa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onRequestDelete(lead)}>
                <Trash2 className="size-4" aria-hidden="true" />
                Excluir lead
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <p className="mf-pipeline-card-preview">{getPreview(lead)}</p>

      <div className="mf-lead-pulse">
        {unread ? (
          <><span className="mf-lead-pulse-dot" /><span>Nova mensagem</span></>
        ) : latest ? (
          <><CheckCheck className="size-3" aria-hidden="true" /><span>Ativo há {timeAgo(latest.createdAt)}</span></>
        ) : (
          <><CirclePlus className="size-3" aria-hidden="true" /><span>Sem interação</span></>
        )}
        <time className="ml-auto">{timeAgo(lead.updatedAt)}</time>
      </div>

      <div className="mf-pipeline-card-actions">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onOpenLead(lead.id) }}
        >
          <MessageCircle className="size-3.5" aria-hidden="true" /> Conversar
        </button>
        <span title={`${lead._count.messages} mensagens`}><MessageCircle className="size-3.5" aria-hidden="true" />{lead._count.messages}</span>
        <span title="Próximo passo"><CalendarDays className="size-3.5" aria-hidden="true" /></span>
      </div>
    </article>
  )
}

function PipelineColumn({
  stage,
  onOpenLead,
  onCreateLead,
  onRequestDelete,
  onDispatch,
}: {
  stage: LeadStage
  onOpenLead: (leadId: string) => void
  onCreateLead: (stageId: string) => void
  onRequestDelete: (lead: Lead) => void
  onDispatch: (stage: LeadStage) => void
}) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [stageName, setStageName] = useState(stage.name)
  const updateStage = useUpdateStage()
  const leadCount = stage._count.leads
  const { setNodeRef, isOver } = useDroppable({
    id: `stage:${stage.id}`,
    data: { type: 'stage', stageId: stage.id },
  })
  // Alça do cabeçalho: arrastar a coluna inteira move todos os leads da etapa.
  const {
    attributes: moveAllAttributes,
    listeners: moveAllListeners,
    setNodeRef: setMoveAllHandleRef,
    isDragging: isMovingAll,
  } = useDraggable({
    id: `stage-leads:${stage.id}`,
    data: { type: 'stage-leads', stageId: stage.id },
    disabled: leadCount === 0 || isEditingName,
  })

  function cancelEditingName() {
    setStageName(stage.name)
    setIsEditingName(false)
  }

  function saveStageName() {
    const name = stageName.trim()
    if (!name || name === stage.name) {
      cancelEditingName()
      return
    }

    updateStage.mutate({ id: stage.id, name }, { onSuccess: () => setIsEditingName(false) })
  }

  return (
    <section
      className={`mf-pipeline-column ${isOver && !isMovingAll ? 'is-over' : ''} ${isMovingAll ? 'is-moving-all' : ''}`}
      style={{ '--mf-stage-color': stage.color } as React.CSSProperties}
    >
      <header className="mf-pipeline-column-header">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="mf-pipeline-stage-mark" />
            {isEditingName ? (
              <input
                value={stageName}
                onChange={(event) => setStageName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') saveStageName()
                  if (event.key === 'Escape') cancelEditingName()
                }}
                className="mf-pipeline-stage-name-input"
                aria-label="Nome da etapa"
                maxLength={50}
                autoFocus
              />
            ) : (
              <h2>{stage.name}</h2>
            )}
            <span className="mf-pipeline-stage-count">{leadCount}</span>
          </div>
          <p>{leadCount === 1 ? '1 lead neste momento' : `${leadCount} leads neste momento`}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isEditingName && leadCount > 0 && (
            <button
              type="button"
              ref={setMoveAllHandleRef}
              {...moveAllAttributes}
              {...moveAllListeners}
              className="mf-pipeline-icon-button mf-pipeline-move-all-handle"
              aria-label={`Arrastar para mover todos os ${leadCount} leads de ${stage.name}`}
              title="Arraste até outra coluna para mover todos os leads"
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button>
          )}
          {!isEditingName && leadCount > 0 && isFollowUpStage(stage.name) && (
            <button
              type="button"
              onClick={() => onDispatch(stage)}
              className="mf-pipeline-icon-button"
              aria-label={`Disparar mensagem para os ${leadCount} leads de ${stage.name}`}
              title="Disparar mensagem para os leads desta coluna"
            >
              <Megaphone className="size-3.5" aria-hidden="true" />
            </button>
          )}
          {isEditingName ? (
            <>
              <button type="button" onClick={saveStageName} disabled={updateStage.isPending || !stageName.trim()} className="mf-pipeline-icon-button" aria-label="Salvar nome da etapa" title="Salvar">
                <Check className="size-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={cancelEditingName} disabled={updateStage.isPending} className="mf-pipeline-icon-button" aria-label="Cancelar edição" title="Cancelar">
                <X className="size-4" aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setStageName(stage.name); setIsEditingName(true) }}
              className="mf-pipeline-icon-button"
              aria-label={`Renomear etapa ${stage.name}`}
              title="Renomear etapa"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onCreateLead(stage.id)}
            className="mf-pipeline-icon-button"
            aria-label={`Adicionar lead em ${stage.name}`}
            title="Adicionar lead"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div ref={setNodeRef} className="mf-pipeline-column-body">
        {stage.leads.map((lead) => <PipelineCard key={lead.id} lead={lead} onOpenLead={onOpenLead} onRequestDelete={onRequestDelete} />)}
        {stage.leads.length === 0 && (
          <div className="mf-pipeline-empty-column">
            <span>Solte leads aqui</span>
            <button type="button" onClick={() => onCreateLead(stage.id)}>Adicionar lead</button>
          </div>
        )}
      </div>
    </section>
  )
}

function NewLeadDialog({
  open,
  onOpenChange,
  stages,
  initialStageId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stages: LeadStage[]
  initialStageId: string | null
}) {
  const createLead = useCreateLead()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const stage = stages.find((item) => item.id === initialStageId) ?? stages[0]

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stage) return
    createLead.mutate(
      { name, phone, stageId: stage.id },
      {
        onSuccess: () => {
          setName('')
          setPhone('')
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mf-pipeline-dialog p-0 sm:max-w-[420px]" showCloseButton={false}>
        <form onSubmit={submit}>
          <DialogHeader className="mf-pipeline-dialog-header">
            <div>
              <DialogTitle>Novo lead</DialogTitle>
              <DialogDescription>O contato entrará em <strong>{stage?.name ?? 'Novos leads'}</strong>.</DialogDescription>
            </div>
            <button type="button" className="mf-pipeline-icon-button" onClick={() => onOpenChange(false)} aria-label="Fechar"><X className="size-4" /></button>
          </DialogHeader>
          <div className="mf-pipeline-form">
            <label>Nome<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do lead" autoFocus /></label>
            <label>WhatsApp<Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(00) 00000-0000" inputMode="tel" /></label>
            {createLead.isError && <p className="mf-pipeline-form-error" role="alert">{createLead.error.message}</p>}
          </div>
          <DialogFooter className="mf-pipeline-dialog-footer">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createLead.isPending}>Cancelar</Button>
            <Button type="submit" disabled={createLead.isPending || !name.trim() || !phone.trim()}>{createLead.isPending ? 'Criando…' : 'Criar lead'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NewStageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createStage = useCreateStage()
  const [name, setName] = useState('')
  const [color, setColor] = useState(STAGE_SWATCHES[0])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createStage.mutate({ name, color }, {
      onSuccess: () => {
        setName('')
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mf-pipeline-dialog p-0 sm:max-w-[420px]" showCloseButton={false}>
        <form onSubmit={submit}>
          <DialogHeader className="mf-pipeline-dialog-header">
            <div><DialogTitle>Nova etapa</DialogTitle><DialogDescription>Crie uma etapa que represente uma decisão real do time comercial.</DialogDescription></div>
            <button type="button" className="mf-pipeline-icon-button" onClick={() => onOpenChange(false)} aria-label="Fechar"><X className="size-4" /></button>
          </DialogHeader>
          <div className="mf-pipeline-form">
            <label>Nome da etapa<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Retorno combinado" autoFocus /></label>
            <fieldset className="mf-pipeline-color-field"><legend>Cor de sinalização</legend><div>{STAGE_SWATCHES.map((swatch) => <button key={swatch} type="button" onClick={() => setColor(swatch)} className={color === swatch ? 'is-selected' : ''} style={{ backgroundColor: swatch }} aria-label={`Usar a cor ${swatch}`} />)}</div></fieldset>
            {createStage.isError && <p className="mf-pipeline-form-error" role="alert">Não foi possível criar a etapa. Tente novamente.</p>}
          </div>
          <DialogFooter className="mf-pipeline-dialog-footer">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createStage.isPending}>Cancelar</Button>
            <Button type="submit" disabled={createStage.isPending || !name.trim()}>{createStage.isPending ? 'Criando…' : 'Criar etapa'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteLeadDialog({
  lead,
  onOpenChange,
}: {
  lead: Lead | null
  onOpenChange: (open: boolean) => void
}) {
  const deleteLead = useDeleteLead()

  function confirmDeletion() {
    if (!lead) return
    deleteLead.mutate(lead.id, {
      onSuccess: () => onOpenChange(false),
    })
  }

  return (
    <Dialog open={Boolean(lead)} onOpenChange={onOpenChange}>
      <DialogContent className="mf-pipeline-dialog p-0 sm:max-w-[440px]" showCloseButton={!deleteLead.isPending}>
        <DialogHeader className="mf-pipeline-dialog-header pr-12">
          <div>
            <DialogTitle>Excluir lead?</DialogTitle>
            <DialogDescription className="mt-2">
              Você está prestes a excluir <strong>{lead ? getLeadDisplayName(lead) : 'este lead'}</strong>. As mensagens, etiquetas e histórico vinculados serão apagados definitivamente.
            </DialogDescription>
          </div>
        </DialogHeader>
        {deleteLead.isError && (
          <p className="px-5 text-sm text-destructive" role="alert">{deleteLead.error.message}</p>
        )}
        <DialogFooter className="mf-pipeline-dialog-footer">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleteLead.isPending}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={confirmDeletion} disabled={deleteLead.isPending}>
            <Trash2 className="size-4" aria-hidden="true" />
            {deleteLead.isPending ? 'Excluindo…' : 'Excluir lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatLeadCount(count: number) {
  return count === 1 ? '1 lead' : `${count} leads`
}

function StageLeadsOverlay({ stage }: { stage: LeadStage }) {
  return (
    <div className="mf-pipeline-stack-overlay" style={{ '--mf-stage-color': stage.color } as React.CSSProperties}>
      <span className="mf-pipeline-stage-mark" />
      <div className="min-w-0">
        <strong>{formatLeadCount(stage._count.leads)}</strong>
        <span className="truncate">{stage.name}</span>
      </div>
    </div>
  )
}

function MoveAllLeadsDialog({
  open,
  from,
  to,
  includesHiddenLeads,
  onOpenChange,
}: {
  open: boolean
  from: LeadStage | null
  to: LeadStage | null
  includesHiddenLeads: boolean
  onOpenChange: (open: boolean) => void
}) {
  const moveAllLeads = useMoveAllLeads()
  const countLabel = formatLeadCount(from?._count.leads ?? 0)

  const notes = [
    includesHiddenLeads && 'A busca e os filtros não se aplicam: os leads ocultos desta etapa também serão movidos.',
    to?.isClosed && 'Eles serão marcados como fechados hoje — os que tiverem valor entram como venda no dashboard.',
    from?.isClosed && 'Eles deixarão de contar como venda fechada no dashboard.',
  ].filter(Boolean) as string[]

  function finish() {
    moveAllLeads.reset()
    onOpenChange(false)
  }

  function close(open: boolean) {
    if (open || moveAllLeads.isPending) return
    finish()
  }

  function confirmMove() {
    if (!from || !to) return
    moveAllLeads.mutate({ fromStageId: from.id, toStageId: to.id }, { onSuccess: finish })
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="mf-pipeline-dialog p-0 sm:max-w-[440px]" showCloseButton={!moveAllLeads.isPending}>
        <DialogHeader className="mf-pipeline-dialog-header pr-12">
          <div>
            <DialogTitle>Mover todos os leads?</DialogTitle>
            <DialogDescription className="mt-2">
              <strong>{countLabel}</strong> de <strong>{from?.name}</strong> vão para <strong>{to?.name}</strong>.
            </DialogDescription>
          </div>
        </DialogHeader>
        {notes.length > 0 && (
          <ul className="mf-pipeline-dialog-notes">
            {notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        )}
        {moveAllLeads.isError && (
          <p className="px-5 text-sm text-destructive" role="alert">{moveAllLeads.error.message}</p>
        )}
        <DialogFooter className="mf-pipeline-dialog-footer">
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={moveAllLeads.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmMove} disabled={moveAllLeads.isPending}>
            {moveAllLeads.isPending ? 'Movendo…' : `Mover ${countLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function KanbanLeads({ onOpenLead, onOpenInbox }: { onOpenLead?: (leadId: string) => void; onOpenInbox?: () => void }) {
  const { data: stages = [], isLoading, isError } = useStages()
  const updateLead = useUpdateLead()
  const [search, setSearch] = useState('')
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [draggingStageId, setDraggingStageId] = useState<string | null>(null)
  // Cópia das etapas no momento do drop: mantém o texto do diálogo estável
  // durante a animação de saída, quando o board já recarregou.
  const [moveAllRequest, setMoveAllRequest] = useState<{ from: LeadStage; to: LeadStage } | null>(null)
  const [isMoveAllOpen, setIsMoveAllOpen] = useState(false)
  const [dispatchStage, setDispatchStage] = useState<LeadStage | null>(null)
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null)
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false)
  const [isNewStageOpen, setIsNewStageOpen] = useState(false)
  const [newLeadStageId, setNewLeadStageId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const visibleStages = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return stages.map((stage) => ({
      ...stage,
      leads: stage.leads.filter((lead) => {
        const matchesTerm = !term || getLeadDisplayName(lead).toLocaleLowerCase('pt-BR').includes(term) || lead.phone.includes(term.replace(/\D/g, ''))
        if (!matchesTerm) return false
        if (activityFilter === 'unread') return hasUnreadMessage(lead)
        if (activityFilter === 'active') return lead.messages.length > 0
        return true
      }),
    }))
  }, [activityFilter, search, stages])

  const totalLeads = stages.reduce((total, stage) => total + stage._count.leads, 0)
  const hasActiveFilters = Boolean(search.trim()) || activityFilter !== 'all'

  function openNewLead(stageId: string | null = stages[0]?.id ?? null) {
    setNewLeadStageId(stageId)
    setIsNewLeadOpen(true)
  }

  const findStage = (stageId: string | null) => (stageId ? stages.find((stage) => stage.id === stageId) ?? null : null)
  const draggingStage = findStage(draggingStageId)

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current
    if (data?.type === 'stage-leads') {
      setDraggingStageId(data.stageId as string)
      return
    }
    setActiveLead(data?.lead as Lead ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null)
    setDraggingStageId(null)
    const data = event.active.data.current
    const targetStageId = event.over?.data.current?.stageId as string | undefined
    if (!targetStageId) return

    // Coluna inteira: só confirma — a mudança acontece no diálogo.
    if (data?.type === 'stage-leads') {
      const from = findStage(data.stageId as string)
      const to = findStage(targetStageId)
      if (from && to && from.id !== to.id) {
        setMoveAllRequest({ from, to })
        setIsMoveAllOpen(true)
      }
      return
    }

    const lead = data?.lead as Lead | undefined
    if (!lead || targetStageId === lead.stageId) return
    updateLead.mutate({ id: lead.id, stageId: targetStageId })
  }

  function handleDragCancel() {
    setActiveLead(null)
    setDraggingStageId(null)
  }

  const openLead = (leadId: string) => onOpenLead?.(leadId)

  if (isLoading) {
    return <div className="mf-pipeline-loading"><Loader2 className="size-5 animate-spin" /><span>Preparando seu pipeline comercial…</span></div>
  }

  if (isError) {
    return <div className="mf-pipeline-loading"><span>Não foi possível carregar os leads agora.</span></div>
  }

  return (
    <div className="mf-pipeline">
      <header className="mf-pipeline-toolbar">
        <div className="mf-pipeline-title-block">
          <p className="mf-eyebrow">CRM comercial · pipeline</p>
          <div className="flex items-end gap-3"><h1>Leads</h1><span>{totalLeads} {totalLeads === 1 ? 'lead no funil' : 'leads no funil'}</span></div>
        </div>

        <div className="mf-pipeline-toolbar-actions">
          <div className="mf-pipeline-view-toggle" aria-label="Visualização do CRM">
            <button type="button" onClick={onOpenInbox}><MessageCircle className="size-3.5" />Conversas</button>
            <button type="button" className="is-active" aria-current="page"><LayoutDashboard className="size-3.5" />Pipeline</button>
          </div>
          <label className="mf-pipeline-search"><Search className="size-4" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar leads…" /><button type="button" onClick={() => setSearch('')} className={search ? '' : 'invisible'} aria-label="Limpar busca"><X className="size-3.5" /></button></label>
          <DropdownMenu>
            <DropdownMenuTrigger className="mf-pipeline-filter"><Filter className="size-3.5" />Filtros</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="mf-pipeline-filter-menu">
              <DropdownMenuLabel>Mostrar no quadro</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={activityFilter} onValueChange={(value) => setActivityFilter(value as ActivityFilter)}>
                <DropdownMenuRadioItem value="all">Todos os leads</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="unread">Com mensagem nova</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="active">Com conversa</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" onClick={() => openNewLead()} className="mf-pipeline-add" title="Adicionar lead"><Plus className="size-4" /><span>Novo lead</span></button>
        </div>
      </header>

      <div className="mf-pipeline-board-shell">
        <div className="mf-pipeline-board-hint"><span>Arraste um cartão para mover o lead — ou a alça <GripVertical className="inline size-3 align-[-2px]" aria-hidden="true" /> da coluna para mover todos</span>{hasActiveFilters ? <button type="button" onClick={() => { setSearch(''); setActivityFilter('all') }}>Limpar filtros</button> : <span>As mudanças são salvas automaticamente</span>}</div>
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
          <div className="mf-pipeline-board">
            {visibleStages.map((stage) => <PipelineColumn key={stage.id} stage={stage} onOpenLead={openLead} onCreateLead={openNewLead} onRequestDelete={setLeadToDelete} onDispatch={setDispatchStage} />)}
            <button type="button" className="mf-pipeline-add-stage" onClick={() => setIsNewStageOpen(true)}><Plus className="size-4" />Adicionar etapa</button>
          </div>
          <DragOverlay dropAnimation={null}>
            {activeLead ? <div className="w-[302px] rotate-1"><PipelineCard lead={activeLead} isOverlay onOpenLead={openLead} onRequestDelete={setLeadToDelete} /></div>
              : draggingStage ? <StageLeadsOverlay stage={draggingStage} />
              : null}
          </DragOverlay>
        </DndContext>
      </div>

      <NewLeadDialog open={isNewLeadOpen} onOpenChange={setIsNewLeadOpen} stages={stages} initialStageId={newLeadStageId} />
      <NewStageDialog open={isNewStageOpen} onOpenChange={setIsNewStageOpen} />
      <DeleteLeadDialog lead={leadToDelete} onOpenChange={(open) => { if (!open) setLeadToDelete(null) }} />
      <MoveAllLeadsDialog
        open={isMoveAllOpen}
        from={moveAllRequest?.from ?? null}
        to={moveAllRequest?.to ?? null}
        includesHiddenLeads={hasActiveFilters}
        onOpenChange={setIsMoveAllOpen}
      />
      {dispatchStage && (
        <CreateCampaignForm
          preset={{ stageId: dispatchStage.id, stageName: dispatchStage.name, leadCount: dispatchStage._count.leads }}
          onClose={() => setDispatchStage(null)}
        />
      )}
    </div>
  )
}
