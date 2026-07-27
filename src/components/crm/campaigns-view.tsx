'use client'

import { useState, useRef, useEffect } from 'react'
import { Megaphone, Plus, Trash2, XCircle, ChevronRight, Image as ImageIcon, Video, Mic, MicOff, Square, Clock, CheckCircle2, AlertCircle, Loader2, CalendarClock, Users, Send } from 'lucide-react'
import { useCampaigns, useCreateCampaign, useCancelCampaign, useDeleteCampaign } from '@/hooks/campaigns-api'
import { useStages } from '@/hooks/crm-api'
import { useCrmTags } from '@/hooks/crm-api'
import type { BulkCampaign } from '@/types/campaign'
import { Button } from '@/components/ui/button'

// ——— Status badge ———
const STATUS_CONFIG = {
  DRAFT:     { label: 'Rascunho',  color: '#64748b', bg: '#1e293b40' },
  SCHEDULED: { label: 'Agendado',  color: '#60a5fa', bg: '#1e3a5f40' },
  RUNNING:   { label: 'Enviando',  color: '#fbbf24', bg: '#78350f40' },
  DONE:      { label: 'Concluído', color: '#4ade80', bg: '#14532d40' },
  CANCELLED: { label: 'Cancelado', color: '#64748b', bg: '#1e293b40' },
}

function StatusBadge({ status }: { status: BulkCampaign['status'] }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: `${cfg.color}30` }}
    >
      {cfg.label}
    </span>
  )
}

function ProgressBar({ total, sent, failed }: { total: number; sent: number; failed: number }) {
  const sentPct = total ? Math.round((sent / total) * 100) : 0
  const failPct = total ? Math.round((failed / total) * 100) : 0
  return (
    <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden flex">
      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${sentPct}%` }} />
      <div className="h-full bg-red-500 transition-all" style={{ width: `${failPct}%` }} />
    </div>
  )
}

// ——— Card de campanha na lista ———
function CampaignCard({
  campaign,
  onCancel,
  onDelete,
}: {
  campaign: BulkCampaign
  onCancel: () => void
  onDelete: () => void
}) {
  const isRunning = campaign.status === 'RUNNING'
  const isCancellable = ['SCHEDULED', 'RUNNING'].includes(campaign.status)
  const isDeletable = campaign.status !== 'RUNNING'
  const done = campaign.sentCount + campaign.failedCount

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{campaign.title}</span>
            <StatusBadge status={campaign.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {campaign.totalLeads} destinatários
            </span>
            {campaign.scheduledAt && (
              <span className="flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                {new Date(campaign.scheduledAt).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
            {campaign.mediaType && (
              <span className="flex items-center gap-1 text-blue-400/70">
                {campaign.mediaType === 'image' ? <ImageIcon className="w-3 h-3" /> : campaign.mediaType === 'audio' ? <Mic className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                {campaign.mediaType === 'image' ? 'Imagem' : campaign.mediaType === 'audio' ? 'Áudio' : 'Vídeo'}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          {isCancellable && (
            <button
              onClick={onCancel}
              title="Cancelar campanha"
              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
          {isDeletable && (
            <button
              onClick={onDelete}
              title="Excluir campanha"
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {(isRunning || campaign.status === 'DONE') && (
        <div className="space-y-1.5">
          <ProgressBar total={campaign.totalLeads} sent={campaign.sentCount} failed={campaign.failedCount} />
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>
              <span className="text-emerald-400 font-semibold">{campaign.sentCount}</span> enviados ·{' '}
              <span className="text-red-400 font-semibold">{campaign.failedCount}</span> falhas
            </span>
            <span>{done}/{campaign.totalLeads}</span>
          </div>
          {isRunning && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Enviando — próximo lote em breve
            </div>
          )}
        </div>
      )}

      {campaign.message && (
        <p className="text-[11px] text-slate-500 line-clamp-2 bg-white/[0.02] rounded-lg px-2.5 py-1.5 border border-white/[0.04]">
          {campaign.message}
        </p>
      )}
    </div>
  )
}

// ——— Formulário de criação (3 etapas) ———
type Step = 'recipients' | 'message' | 'schedule'

interface FormState {
  title: string
  filter: { type: 'all' | 'stages' | 'labels' | 'followUp'; ids: string[] }
  message: string
  mediaFile: File | null
  mediaPreview: string | null
  mediaCaption: string
  scheduledAt: string  // ISO string ou ''
  delaySeconds: number
}

function CreateCampaignForm({ onClose }: { onClose: () => void }) {
  const { data: stages = [] } = useStages()
  const { data: tags = [] } = useCrmTags()
  const createCampaign = useCreateCampaign()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('recipients')
  const [form, setForm] = useState<FormState>({
    title: '',
    filter: { type: 'all', ids: [] },
    message: '',
    mediaFile: null,
    mediaPreview: null,
    mediaCaption: '',
    scheduledAt: '',
    delaySeconds: 7,
  })
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      mediaRecorderRef.current?.stop()
    }
  }, [])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg'
      const mr = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const ext = mimeType.includes('ogg') ? 'ogg' : 'webm'
        const file = new File([blob], `gravacao.${ext}`, { type: mimeType })
        const reader = new FileReader()
        reader.onload = (e) => {
          update({ mediaFile: file, mediaPreview: e.target?.result as string ?? null })
        }
        reader.readAsDataURL(blob)
        if (timerRef.current) clearInterval(timerRef.current)
        setRecording(false)
      }
      mr.start(250)
      mediaRecorderRef.current = mr
      setRecordSeconds(0)
      setRecording(true)
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    } catch {
      setError('Permissão de microfone negada ou indisponível')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }

  function update(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }))
  }

  function toggleId(id: string) {
    const ids = form.filter.ids.includes(id)
      ? form.filter.ids.filter((x) => x !== id)
      : [...form.filter.ids, id]
    update({ filter: { ...form.filter, ids } })
  }

  function handleFile(file: File | null) {
    if (!file) {
      update({ mediaFile: null, mediaPreview: null })
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      update({ mediaFile: file, mediaPreview: e.target?.result as string ?? null })
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    setError('')
    if (!form.title.trim()) { setError('Informe o título da campanha'); return }
    if (!form.message.trim() && !form.mediaFile) { setError('Informe uma mensagem ou selecione uma mídia'); return }
    if (form.filter.type !== 'all' && form.filter.ids.length === 0) {
      setError('Selecione pelo menos um estágio ou etiqueta'); return
    }

    let mediaBase64: string | undefined
    let mediaType: string | undefined
    let mimeType: string | undefined
    let fileName: string | undefined

    if (form.mediaFile && form.mediaPreview) {
      // Remove "data:image/jpeg;base64," prefix
      mediaBase64 = form.mediaPreview.split(',')[1]
      mimeType = form.mediaFile.type
      fileName = form.mediaFile.name
      if (mimeType.startsWith('image/')) mediaType = 'image'
      else if (mimeType.startsWith('video/')) mediaType = 'video'
      else if (mimeType.startsWith('audio/')) mediaType = 'audio'
      else mediaType = 'document'
    }

    try {
      await createCampaign.mutateAsync({
        title: form.title.trim(),
        message: form.message.trim() || undefined,
        mediaBase64,
        mediaType,
        mimeType,
        fileName,
        mediaCaption: form.mediaCaption.trim() || undefined,
        scheduledAt: form.scheduledAt || undefined,
        delaySeconds: form.delaySeconds,
        filter: {
          type: form.filter.type,
          ids: form.filter.ids.length ? form.filter.ids : undefined,
        },
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar campanha')
    }
  }

  const isLast = step === 'schedule'
  const steps: Step[] = ['recipients', 'message', 'schedule']
  const stepIdx = steps.indexOf(step)
  const stepLabels = ['Destinatários', 'Mensagem', 'Agendamento']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d0f17] border border-white/[0.1] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-blue-400" />
              Nova Campanha
            </h2>
            <button onClick={onClose} className="text-slate-500 hover:text-white cursor-pointer transition-colors">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Título sempre visível */}
          <input
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Nome da campanha..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 mb-3"
          />

          {/* Steps */}
          <div className="flex items-center gap-1">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-1 flex-1">
                <button
                  onClick={() => i < stepIdx && setStep(steps[i])}
                  className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
                    i === stepIdx ? 'text-blue-400' : i < stepIdx ? 'text-slate-400 cursor-pointer hover:text-white' : 'text-slate-600'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === stepIdx ? 'bg-blue-500 text-white' : i < stepIdx ? 'bg-white/10 text-slate-400' : 'bg-white/[0.04] text-slate-600'
                  }`}>{i + 1}</span>
                  {label}
                </button>
                {i < 2 && <ChevronRight className="w-3 h-3 text-slate-700 shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Step 1: Destinatários */}
          {step === 'recipients' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Quem vai receber esta campanha?</p>

              {/* Tipo de filtro */}
              <div className="grid grid-cols-2 gap-2">
                {(['all', 'stages', 'labels', 'followUp'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => update({ filter: { type, ids: [] } })}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      form.filter.type === type
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                        : 'bg-white/[0.03] border-white/[0.07] text-slate-500 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {type === 'all' ? 'Todos os leads' : type === 'stages' ? 'Por Estágio' : type === 'labels' ? 'Por Etiqueta' : 'Follow Up'}
                  </button>
                ))}
              </div>

              {/* Seleção de estágios */}
              {form.filter.type === 'stages' && (
                <div className="space-y-1.5">
                  {stages.map((s) => (
                    <label key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-pointer hover:bg-white/[0.05] transition-colors">
                      <input
                        type="checkbox"
                        checked={form.filter.ids.includes(s.id)}
                        onChange={() => toggleId(s.id)}
                        className="rounded"
                      />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-sm text-white flex-1">{s.name}</span>
                      <span className="text-[11px] text-slate-500 tabular-nums">{s._count.leads} leads</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Seleção de etiquetas */}
              {form.filter.type === 'labels' && (
                <div className="space-y-1.5">
                  {tags.map((t) => (
                    <label key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-pointer hover:bg-white/[0.05] transition-colors">
                      <input
                        type="checkbox"
                        checked={form.filter.ids.includes(t.id)}
                        onChange={() => toggleId(t.id)}
                        className="rounded"
                      />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="text-sm text-white flex-1">{t.name}</span>
                    </label>
                  ))}
                </div>
              )}

              {form.filter.type === 'all' && (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2.5 text-[11px] text-amber-300">
                  Todos os leads do CRM receberão esta mensagem. Confirme que é isso mesmo.
                </div>
              )}
            </div>
          )}

          {/* Step 2: Mensagem */}
          {step === 'message' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Compose a mensagem ou selecione uma mídia.</p>

              {/* Mídia */}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                {form.mediaPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-black/20">
                    {form.mediaFile?.type.startsWith('image/') ? (
                      <img src={form.mediaPreview} alt="Preview" className="w-full max-h-48 object-contain" />
                    ) : form.mediaFile?.type.startsWith('audio/') ? (
                      <div className="flex items-center gap-3 p-4">
                        <Mic className="w-8 h-8 text-emerald-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{form.mediaFile?.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {form.mediaFile ? `${(form.mediaFile.size / 1024 / 1024).toFixed(1)} MB · Áudio PTT` : ''}
                          </p>
                          <audio controls src={form.mediaPreview ?? ''} className="mt-2 w-full h-8" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-4">
                        <Video className="w-8 h-8 text-blue-400" />
                        <div>
                          <p className="text-sm text-white font-medium">{form.mediaFile?.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {form.mediaFile ? `${(form.mediaFile.size / 1024 / 1024).toFixed(1)} MB` : ''}
                          </p>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => { update({ mediaFile: null, mediaPreview: null }); if (fileRef.current) fileRef.current.value = '' }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer hover:bg-black/80"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : recording ? (
                  <div className="w-full py-5 rounded-xl border-2 border-red-500/40 bg-red-500/10 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-red-400 font-semibold text-sm tabular-nums">
                        {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}
                      </span>
                      <span className="text-slate-500 text-xs">Gravando...</span>
                    </div>
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-colors cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Parar gravação
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex-1 py-5 rounded-xl border-2 border-dashed border-white/[0.08] text-slate-500 hover:text-white hover:border-white/20 transition-colors cursor-pointer flex flex-col items-center gap-2 text-xs"
                    >
                      <div className="flex gap-2">
                        <ImageIcon className="w-4 h-4" />
                        <Video className="w-4 h-4" />
                        <Mic className="w-4 h-4" />
                      </div>
                      Anexar arquivo
                    </button>
                    <button
                      onClick={startRecording}
                      className="flex-1 py-5 rounded-xl border-2 border-dashed border-white/[0.08] text-slate-500 hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer flex flex-col items-center gap-2 text-xs"
                    >
                      <MicOff className="w-4 h-4" />
                      Gravar áudio
                    </button>
                  </div>
                )}
              </div>

              {/* Legenda da mídia (só para imagem/vídeo) */}
              {form.mediaPreview && !form.mediaFile?.type.startsWith('audio/') && (
                <input
                  value={form.mediaCaption}
                  onChange={(e) => update({ mediaCaption: e.target.value })}
                  placeholder="Legenda da mídia (opcional)..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50"
                />
              )}

              {/* Texto */}
              <textarea
                value={form.message}
                onChange={(e) => update({ message: e.target.value })}
                placeholder={form.mediaPreview ? 'Mensagem adicional (opcional)...' : 'Digite a mensagem...'}
                rows={5}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 resize-none"
              />

              {form.mediaFile && (form.mediaFile.size / 1024 / 1024) > 15 && (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 text-[11px] text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Arquivo grande ({(form.mediaFile.size / 1024 / 1024).toFixed(0)} MB). O envio pode falhar para alguns leads.
                </div>
              )}
            </div>
          )}

          {/* Step 3: Agendamento */}
          {step === 'schedule' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Quando deseja enviar a campanha?</p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => update({ scheduledAt: '' })}
                  className={`py-4 rounded-xl text-sm font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    !form.scheduledAt
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : 'bg-white/[0.03] border-white/[0.07] text-slate-400 hover:border-white/20'
                  }`}
                >
                  <Send className="w-5 h-5" />
                  Enviar agora
                </button>
                <button
                  onClick={() => {
                    const d = new Date(); d.setMinutes(d.getMinutes() + 30)
                    update({ scheduledAt: d.toISOString().slice(0, 16) })
                  }}
                  className={`py-4 rounded-xl text-sm font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    form.scheduledAt
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : 'bg-white/[0.03] border-white/[0.07] text-slate-400 hover:border-white/20'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  Agendar
                </button>
              </div>

              {form.scheduledAt && (
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-500">Data e hora do envio</label>
                  <input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => update({ scheduledAt: e.target.value })}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500">
                  Intervalo entre mensagens: <span className="text-white font-semibold">{form.delaySeconds}s</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={30}
                  value={form.delaySeconds}
                  onChange={(e) => update({ delaySeconds: Number(e.target.value) })}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>3s (mais rápido, mais risco)</span>
                  <span>30s (mais seguro)</span>
                </div>
              </div>

              {/* Resumo */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Destinatários</span>
                  <span className="text-white font-medium">
                    {form.filter.type === 'all' ? 'Todos os leads' :
                     form.filter.type === 'stages' ? `${form.filter.ids.length} estágio(s)` :
                     form.filter.type === 'labels' ? `${form.filter.ids.length} etiqueta(s)` :
                     'Leads em Follow Up'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Conteúdo</span>
                  <span className="text-white font-medium">
                    {form.mediaFile
                      ? `${form.mediaFile.type.startsWith('image/') ? 'Imagem' : form.mediaFile.type.startsWith('audio/') ? 'Áudio PTT' : 'Vídeo'}${form.message ? ' + texto' : ''}`
                      : 'Texto'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Envio</span>
                  <span className="text-white font-medium">
                    {form.scheduledAt
                      ? new Date(form.scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : 'Imediato'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.07] shrink-0 flex gap-3">
          {stepIdx > 0 && (
            <Button
              variant="ghost"
              onClick={() => setStep(steps[stepIdx - 1])}
              disabled={recording}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              Voltar
            </Button>
          )}
          <Button
            onClick={isLast ? handleSubmit : () => setStep(steps[stepIdx + 1])}
            disabled={createCampaign.isPending || recording}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer gap-1.5"
          >
            {createCampaign.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isLast ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            {createCampaign.isPending ? 'Criando...' : isLast ? 'Criar Campanha' : 'Próximo'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ——— View principal ———
export function CampaignsView() {
  const { data: campaigns = [], isLoading } = useCampaigns()
  const cancelCampaign = useCancelCampaign()
  const deleteCampaign = useDeleteCampaign()
  const [creating, setCreating] = useState(false)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sub-header */}
      <div className="px-6 py-3 border-b border-white/[0.04] bg-[#07080c]/40 shrink-0 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          <span className="text-white font-semibold tabular-nums">{campaigns.length}</span> campanhas
        </span>
        <Button
          size="sm"
          onClick={() => setCreating(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs cursor-pointer gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Campanha
        </Button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-5">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Megaphone className="w-12 h-12 text-slate-700" />
            <div>
              <p className="text-sm text-slate-400 font-medium">Nenhuma campanha criada</p>
              <p className="text-xs text-slate-600 mt-1">Crie uma campanha para disparar mensagens em massa</p>
            </div>
            <Button
              onClick={() => setCreating(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white cursor-pointer gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Criar primeira campanha
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                onCancel={() => cancelCampaign.mutate(c.id)}
                onDelete={() => {
                  if (window.confirm(`Excluir campanha "${c.title}"?`)) {
                    deleteCampaign.mutate(c.id)
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {creating && <CreateCampaignForm onClose={() => setCreating(false)} />}
    </div>
  )
}
