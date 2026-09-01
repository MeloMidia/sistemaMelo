'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown, CircleDollarSign, ClipboardList, Loader2,
  MessageSquare, Pencil, Plus, ReceiptText, X,
} from 'lucide-react'
import type { Lead, Negotiation } from '@/types/crm'
import { formatPhoneNumber, getLeadDisplayName } from '@/lib/phone'
import { useAttachTag, useCreateCrmTag, useCrmTags, useCrmUsers, useDetachTag, useStages, useUpdateLead } from '@/hooks/crm-api'
import { useColumns } from '@/hooks/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type LeadForm = {
  name: string
  assignedToId: string
  notes: string
  city: string
  instagram: string
  mercadoLivreStatus: string
  businessArea: string
  companyName: string
  mlKnowledge: string
  stock: string
  revenue: string
  employees: string
  partners: string
}

const MERCADO_LIVRE_STATUS_OPTIONS = ['Sim', 'Não', 'Vendeu mas parou', 'Outro']
const BUSINESS_AREA_OPTIONS = ['Linha leve', 'Linha pesada', 'Moto peças', 'Outro']
const ML_KNOWLEDGE_OPTIONS = ['Muito', 'Médio', 'Pouco', 'Muito pouco']

type NegotiationForm = {
  stageId: string
  responsibleId: string
  negotiatedAt: string
  service: string
  quantity: string
  unitPrice: string
  discount: string
  notes: string
  tagIds: string[]
}

function todayInputValue() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getForm(lead: Lead): LeadForm {
  return {
    name: lead.name ?? '',
    assignedToId: lead.assignedToId ?? '',
    notes: lead.notes ?? '',
    city: lead.city ?? '',
    instagram: lead.instagram ?? '',
    mercadoLivreStatus: lead.mercadoLivreStatus ?? '',
    businessArea: lead.businessArea ?? '',
    companyName: lead.companyName ?? '',
    mlKnowledge: lead.mlKnowledge ?? '',
    stock: lead.stock ?? '',
    revenue: lead.revenue ?? '',
    employees: lead.employees ?? '',
    partners: lead.partners ?? '',
  }
}

function toNullable(value: string) {
  const trimmed = value.trim()
  return trimmed || null
}

function Avatar({ lead }: { lead: Lead }) {
  const name = getLeadDisplayName(lead)

  if (lead.profilePicUrl) {
    return (
      // WhatsApp avatars are external and may not be compatible with next/image remote patterns.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={lead.profilePicUrl} alt="" width={44} height={44} className="size-11 rounded-full object-cover ring-1 ring-black/10" />
    )
  }

  return <div className="mf-profile-avatar">{name.slice(0, 1).toUpperCase()}</div>
}

function DetailSection({
  icon: Icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: typeof CircleDollarSign
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className="mf-profile-section" open={defaultOpen}>
      <summary>
        <span><Icon className="size-3.5" aria-hidden="true" />{title}</span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </summary>
      <div className="mf-profile-section-body">{children}</div>
    </details>
  )
}

export function LeadProfilePanel({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient()
  const profileQuery = useQuery<Lead>({
    queryKey: ['crm-lead-profile', leadId],
    queryFn: async () => {
      const response = await fetch(`/api/crm/leads/${leadId}`)
      if (!response.ok) throw new Error('Não foi possível carregar o perfil do lead.')
      return response.json()
    },
    staleTime: 10_000,
  })
  const { data: tags = [] } = useCrmTags()
  const { data: users = [] } = useCrmUsers()
  const { data: stages = [] } = useStages()
  const { data: negotiationColumns = [] } = useColumns('negotiations')
  const negotiationsQuery = useQuery<Negotiation[]>({
    queryKey: ['crm-lead-negotiations', leadId],
    queryFn: async () => {
      const response = await fetch(`/api/crm/leads/${leadId}/negotiations`)
      if (!response.ok) throw new Error('Não foi possível carregar as negociações.')
      return response.json()
    },
    staleTime: 10_000,
  })
  const updateLead = useUpdateLead()
  const createTag = useCreateCrmTag()
  const attachTag = useAttachTag(leadId)
  const detachTag = useDetachTag(leadId)
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [form, setForm] = useState<LeadForm | null>(null)
  const [isNegotiationOpen, setIsNegotiationOpen] = useState(false)
  const [negotiationForm, setNegotiationForm] = useState<NegotiationForm | null>(null)

  const createNegotiation = useMutation({
    mutationFn: async (data: NegotiationForm) => {
      const response = await fetch(`/api/crm/leads/${leadId}/negotiations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          quantity: Number(data.quantity),
          unitPrice: Number(data.unitPrice),
          discount: Number(data.discount),
        }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Não foi possível criar a negociação.')
      }
      return response.json() as Promise<Negotiation>
    },
    onSuccess: () => {
      setIsNegotiationOpen(false)
      setNegotiationForm(null)
      queryClient.invalidateQueries({ queryKey: ['crm-lead-negotiations', leadId] })
      queryClient.invalidateQueries({ queryKey: ['columns', 'negotiations'] })
    },
  })

  const lead = profileQuery.data
  const attachedTagIds = useMemo(() => new Set(lead?.tags.map((entry) => entry.tagId) ?? []), [lead?.tags])
  const availableTags = tags.filter((tag) =>
    !attachedTagIds.has(tag.id) && tag.name.toLocaleLowerCase('pt-BR').includes(tagSearch.toLocaleLowerCase('pt-BR'))
  )

  function refreshProfile() {
    queryClient.invalidateQueries({ queryKey: ['crm-lead-profile', leadId] })
    queryClient.invalidateQueries({ queryKey: ['crm-conversations'] })
  }

  function openEditor() {
    if (!lead) return
    setForm(getForm(lead))
    setIsEditorOpen(true)
  }

  function openNegotiationDialog() {
    const defaultStage = negotiationColumns.find((column) => column.title.toLocaleLowerCase('pt-BR') === 'em negociação') ?? negotiationColumns[0]
    setNegotiationForm({
      stageId: defaultStage?.id ?? '',
      responsibleId: lead?.assignedToId ?? '',
      negotiatedAt: todayInputValue(),
      service: '',
      quantity: '1',
      unitPrice: '0',
      discount: '0',
      notes: '',
      tagIds: lead?.tags.map(({ tagId }) => tagId) ?? [],
    })
    setIsNegotiationOpen(true)
  }

  function updateNegotiationForm<Key extends keyof NegotiationForm>(key: Key, value: NegotiationForm[Key]) {
    setNegotiationForm((current) => current ? { ...current, [key]: value } : current)
  }

  function toggleNegotiationTag(tagId: string) {
    setNegotiationForm((current) => current
      ? { ...current, tagIds: current.tagIds.includes(tagId) ? current.tagIds.filter((id) => id !== tagId) : [...current.tagIds, tagId] }
      : current)
  }

  function saveNegotiation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (negotiationForm) createNegotiation.mutate(negotiationForm)
  }

  function updateForm<Key extends keyof LeadForm>(key: Key, value: LeadForm[Key]) {
    setForm((current) => current ? { ...current, [key]: value } : current)
  }

  function createAndAttachTag() {
    const name = newTagName.trim()
    if (!name) return

    createTag.mutate(
      { name, color: '#2854DF' },
      {
        onSuccess: (tag) => attachTag.mutate(tag.id, { onSuccess: () => { setNewTagName(''); refreshProfile() } }),
      }
    )
  }

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lead || !form) return

    updateLead.mutate(
      {
        id: lead.id,
        name: toNullable(form.name),
        assignedToId: form.assignedToId || null,
        notes: toNullable(form.notes),
        city: toNullable(form.city),
        instagram: toNullable(form.instagram),
        mercadoLivreStatus: toNullable(form.mercadoLivreStatus),
        businessArea: toNullable(form.businessArea),
        companyName: toNullable(form.companyName),
        mlKnowledge: toNullable(form.mlKnowledge),
        stock: toNullable(form.stock),
        revenue: toNullable(form.revenue),
        employees: toNullable(form.employees),
        partners: toNullable(form.partners),
      },
      { onSuccess: () => { setIsEditorOpen(false); refreshProfile() } }
    )
  }

  if (profileQuery.isLoading) {
    return <aside className="mf-lead-profile hidden xl:flex w-[336px] shrink-0 items-center justify-center"><Loader2 className="size-5 animate-spin text-[var(--mf-signal)]" /></aside>
  }

  if (!lead || profileQuery.isError) return null

  const displayName = getLeadDisplayName(lead)
  const strategicDetails = [
    ['Já vende pelo ML', lead.mercadoLivreStatus],
    ['Área de atuação', lead.businessArea],
    ['Empresa', lead.companyName],
    ['Cidade', lead.city],
    ['Conhecimento ML', lead.mlKnowledge],
    ['Estoque', lead.stock],
    ['Faturamento', lead.revenue],
    ['Colaboradores', lead.employees],
    ['Sócios', lead.partners],
    ['Instagram', lead.instagram],
  ] as const

  return (
    <aside className="mf-lead-profile hidden xl:flex w-[336px] shrink-0 min-h-0 flex-col overflow-y-auto">
      <div className="mf-profile-header">
        <Avatar lead={lead} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate">{displayName}</h2>
          <p>{formatPhoneNumber(lead.phone)}</p>
        </div>
        <button type="button" onClick={openEditor} className="mf-profile-icon-button" aria-label="Editar informações do lead" title="Editar informações">
          <Pencil className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mf-profile-content">
        <section className="mf-profile-block">
          <div className="mf-profile-block-heading"><span>Estágio</span></div>
          <select
            value={lead.stageId ?? ''}
            onChange={(event) => {
              const stageId = event.target.value || null
              updateLead.mutate({ id: lead.id, stageId }, { onSuccess: refreshProfile })
            }}
            disabled={updateLead.isPending}
            className="mf-profile-input"
            aria-label="Estágio do lead no funil"
          >
            <option value="">Sem estágio (fora do funil)</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>{stage.name}</option>
            ))}
          </select>
        </section>

        <section className="mf-profile-block">
          <div className="mf-profile-block-heading">
            <span>Etiquetas</span>
            <button type="button" onClick={() => setIsTagPickerOpen((open) => !open)} className="mf-profile-add-button" aria-label="Adicionar etiqueta" title="Adicionar etiqueta">
              <Plus className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lead.tags.map(({ tag }) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => detachTag.mutate(tag.id, { onSuccess: refreshProfile })}
                className="mf-profile-tag"
                style={{ '--tag-color': tag.color } as React.CSSProperties}
                title={`Remover etiqueta ${tag.name}`}
              >
                {tag.name}<X className="size-3" aria-hidden="true" />
              </button>
            ))}
            {lead.tags.length === 0 && <p className="mf-profile-empty-copy">Sem etiquetas</p>}
          </div>

          {isTagPickerOpen && (
            <div className="mf-tag-picker">
              <Input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Buscar etiqueta…" aria-label="Buscar etiqueta" autoComplete="off" className="mf-profile-input h-9" />
              <div className="mf-tag-picker-list">
                {availableTags.map((tag) => (
                  <button key={tag.id} type="button" onClick={() => attachTag.mutate(tag.id, { onSuccess: refreshProfile })}>
                    <span style={{ backgroundColor: tag.color }} />{tag.name}
                  </button>
                ))}
                {availableTags.length === 0 && <p>Nenhuma etiqueta encontrada.</p>}
              </div>
              <div className="mf-tag-create">
                <Input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && createAndAttachTag()} placeholder="Nova etiqueta" aria-label="Nome da nova etiqueta" autoComplete="off" className="mf-profile-input h-9" />
                <button type="button" onClick={createAndAttachTag} disabled={!newTagName.trim() || createTag.isPending} aria-label="Criar etiqueta">
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="mf-profile-block">
          <div className="mf-profile-block-heading"><span>Descrição de lead</span><button type="button" onClick={openEditor} className="mf-profile-icon-button" aria-label="Editar descrição"><Pencil className="size-3.5" aria-hidden="true" /></button></div>
          <p className={`mf-profile-description ${lead.notes ? '' : 'is-empty'}`}>{lead.notes || 'Adicione um contexto útil para o time.'}</p>
        </section>

        <div className="mf-profile-sections">
          <DetailSection icon={ClipboardList} title="Informações estratégicas" defaultOpen>
            <dl className="mf-profile-form-answers">
              {strategicDetails.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className={value ? '' : 'is-empty'}>{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </DetailSection>
          <DetailSection icon={CircleDollarSign} title="Negociações" defaultOpen>
            <div className="mf-profile-negotiations">
              {negotiationsQuery.isLoading && <Loader2 className="size-4 animate-spin text-[var(--mf-success)]" />}
              {!negotiationsQuery.isLoading && (negotiationsQuery.data?.length ?? 0) === 0 && (
                <div className="mf-profile-negotiations-empty"><ReceiptText className="size-5" aria-hidden="true" /><span>Nenhuma negociação criada.</span></div>
              )}
              {negotiationsQuery.data?.map((negotiation) => {
                const stage = negotiationColumns.find((column) => column.id === negotiation.task.columnId)
                return (
                  <div key={negotiation.id} className="mf-profile-negotiation-card">
                    <div><strong>{negotiation.service}</strong><span>{formatCurrency(negotiation.totalValue)}</span></div>
                    <p>{stage?.title ?? 'Em negociação'} · {negotiation.responsible?.name ?? 'Sem responsável'}</p>
                  </div>
                )
              })}
              <button type="button" onClick={openNegotiationDialog} className="mf-profile-negotiation-create"><Plus className="size-4" aria-hidden="true" />Negociação</button>
            </div>
          </DetailSection>
          <DetailSection icon={MessageSquare} title="Mensagens">
            <p>{lead._count.messages} interação{lead._count.messages === 1 ? '' : 'ões'} registrada{lead._count.messages === 1 ? '' : 's'}.</p>
          </DetailSection>
          <DetailSection icon={ClipboardList} title="Tarefas">
            <p>{lead._count.tasks ?? 0} tarefa{lead._count.tasks === 1 ? '' : 's'} vinculada{lead._count.tasks === 1 ? '' : 's'}.</p>
          </DetailSection>
        </div>
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="mf-lead-editor max-w-[680px] p-0 sm:max-w-[680px]" showCloseButton={false}>
          <form onSubmit={saveProfile}>
            <DialogHeader className="mf-lead-editor-header">
              <div><DialogTitle>Editar informações</DialogTitle><DialogDescription>Atualize somente o que ajuda o time a atender melhor este lead.</DialogDescription></div>
              <button type="button" onClick={() => setIsEditorOpen(false)} className="mf-profile-icon-button" aria-label="Fechar edição"><X className="size-4" aria-hidden="true" /></button>
            </DialogHeader>
            {form && (
              <div className="mf-lead-editor-grid">
                <Field label="Nome"><Input name="name" autoComplete="name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} className="mf-profile-input" placeholder="Nome do lead" /></Field>
                <Field label="Responsável"><select name="assignedToId" value={form.assignedToId} onChange={(event) => updateForm('assignedToId', event.target.value)} className="mf-profile-input"><option value="">Sem responsável</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
                <Field label="Já vende pelo Mercado Livre"><select name="mercadoLivreStatus" value={form.mercadoLivreStatus} onChange={(event) => updateForm('mercadoLivreStatus', event.target.value)} className="mf-profile-input"><option value="">Selecione</option>{MERCADO_LIVRE_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
                <Field label="Área de atuação"><select name="businessArea" value={form.businessArea} onChange={(event) => updateForm('businessArea', event.target.value)} className="mf-profile-input"><option value="">Selecione</option>{BUSINESS_AREA_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
                <Field label="Nome da empresa"><Input name="companyName" value={form.companyName} onChange={(event) => updateForm('companyName', event.target.value)} className="mf-profile-input" placeholder="Nome da empresa" /></Field>
                <Field label="Cidade"><Input name="city" autoComplete="address-level2" value={form.city} onChange={(event) => updateForm('city', event.target.value)} className="mf-profile-input" placeholder="Cidade" /></Field>
                <Field label="Conhecimento sobre ML"><select name="mlKnowledge" value={form.mlKnowledge} onChange={(event) => updateForm('mlKnowledge', event.target.value)} className="mf-profile-input"><option value="">Selecione</option>{ML_KNOWLEDGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
                <Field label="Estoque"><Input name="stock" value={form.stock} onChange={(event) => updateForm('stock', event.target.value)} className="mf-profile-input" placeholder="Ex.: 200 peças, baixo, médio..." /></Field>
                <Field label="Faturamento"><Input name="revenue" value={form.revenue} onChange={(event) => updateForm('revenue', event.target.value)} className="mf-profile-input" placeholder="Ex.: R$ 30 mil/mês" /></Field>
                <Field label="Colaboradores"><Input name="employees" value={form.employees} onChange={(event) => updateForm('employees', event.target.value)} className="mf-profile-input" placeholder="Quantidade de colaboradores" /></Field>
                <Field label="Sócios"><Input name="partners" value={form.partners} onChange={(event) => updateForm('partners', event.target.value)} className="mf-profile-input" placeholder="Sócios envolvidos" /></Field>
                <Field label="Instagram"><Input name="instagram" value={form.instagram} onChange={(event) => updateForm('instagram', event.target.value)} className="mf-profile-input" placeholder="@usuario" /></Field>
                <Field label="Descrição de lead" className="sm:col-span-2"><textarea name="notes" value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} className="mf-profile-input min-h-24 resize-y" placeholder="Contexto, observações ou preferências deste lead…" /></Field>
              </div>
            )}
            <DialogFooter className="mf-lead-editor-footer">
              {updateLead.isError && <p role="alert" className="mr-auto text-xs text-[var(--mf-danger)]">Não foi possível salvar. Tente novamente.</p>}
              <Button type="button" variant="outline" onClick={() => setIsEditorOpen(false)} disabled={updateLead.isPending}>Cancelar</Button>
              <Button type="submit" disabled={updateLead.isPending}>{updateLead.isPending ? 'Salvando…' : 'Salvar alterações'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isNegotiationOpen} onOpenChange={setIsNegotiationOpen}>
        <DialogContent className="mf-negotiation-dialog max-w-[720px] gap-0 p-0 sm:max-w-[720px]" showCloseButton={false}>
          <form onSubmit={saveNegotiation}>
            <DialogHeader className="mf-negotiation-dialog-header">
              <div><DialogTitle>Nova negociação</DialogTitle><DialogDescription>Registre a proposta e envie este lead diretamente para a etapa correta.</DialogDescription></div>
              <button type="button" onClick={() => setIsNegotiationOpen(false)} className="mf-profile-icon-button" aria-label="Fechar negociação"><X className="size-4" aria-hidden="true" /></button>
            </DialogHeader>
            {negotiationForm && (
              <div className="mf-negotiation-form">
                <Field label="Cliente"><Input value={displayName} readOnly className="mf-profile-input" /></Field>
                <Field label="Data da negociação"><Input type="date" value={negotiationForm.negotiatedAt} onChange={(event) => updateNegotiationForm('negotiatedAt', event.target.value)} className="mf-profile-input" required /></Field>
                <Field label="Responsável"><select value={negotiationForm.responsibleId} onChange={(event) => updateNegotiationForm('responsibleId', event.target.value)} className="mf-profile-input"><option value="">Sem responsável</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
                <Field label="Estágio"><select value={negotiationForm.stageId} onChange={(event) => updateNegotiationForm('stageId', event.target.value)} className="mf-profile-input" required><option value="" disabled>Selecione o estágio</option>{negotiationColumns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}</select></Field>
                <div className="sm:col-span-2"><span className="mf-negotiation-field-label">Etiquetas</span><div className="mf-negotiation-tags">{tags.map((tag) => <button key={tag.id} type="button" onClick={() => toggleNegotiationTag(tag.id)} className={negotiationForm.tagIds.includes(tag.id) ? 'is-selected' : ''} style={{ '--tag-color': tag.color } as React.CSSProperties}>{tag.name}</button>)}</div></div>
                <Field label="Serviço" className="sm:col-span-2"><Input value={negotiationForm.service} onChange={(event) => updateNegotiationForm('service', event.target.value)} placeholder="Serviço negociado" className="mf-profile-input" required /></Field>
                <Field label="Quantidade"><Input type="number" min="1" step="1" value={negotiationForm.quantity} onChange={(event) => updateNegotiationForm('quantity', event.target.value)} className="mf-profile-input" required /></Field>
                <Field label="Valor unitário"><Input type="number" min="0" step="0.01" value={negotiationForm.unitPrice} onChange={(event) => updateNegotiationForm('unitPrice', event.target.value)} className="mf-profile-input" required /></Field>
                <Field label="Desconto"><Input type="number" min="0" step="0.01" value={negotiationForm.discount} onChange={(event) => updateNegotiationForm('discount', event.target.value)} className="mf-profile-input" /></Field>
                <div className="mf-negotiation-total"><span>Valor total</span><strong>{formatCurrency(Math.max(0, Number(negotiationForm.quantity || 0) * Number(negotiationForm.unitPrice || 0) - Number(negotiationForm.discount || 0)))}</strong></div>
                <Field label="Observações" className="sm:col-span-2"><textarea value={negotiationForm.notes} onChange={(event) => updateNegotiationForm('notes', event.target.value)} className="mf-profile-input min-h-24 resize-y" placeholder="Contexto comercial, condições ou próximos passos…" /></Field>
              </div>
            )}
            <DialogFooter className="mf-negotiation-dialog-footer">
              {createNegotiation.isError && <p role="alert" className="mr-auto text-xs text-[var(--mf-danger)]">{(createNegotiation.error as Error).message}</p>}
              <Button type="button" variant="outline" onClick={() => setIsNegotiationOpen(false)} disabled={createNegotiation.isPending}>Cancelar</Button>
              <Button type="submit" disabled={createNegotiation.isPending || !negotiationForm?.stageId}>{createNegotiation.isPending ? 'Criando…' : 'Criar negociação'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  )
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={className}>{label}{children}</label>
}
