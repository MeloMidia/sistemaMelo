'use client'

import { useState, useEffect } from 'react'
import { Megaphone, Zap, Calendar, Layers, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useColumns, useUpdateTask, useExpirePromos } from '@/hooks/api'
import type { Task } from '@/types'

function Toggle({
  checked,
  onChange,
  variant = 'green',
  size = 'md',
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  variant?: 'green' | 'red-green'
  size?: 'sm' | 'md'
  disabled?: boolean
}) {
  const trackOn = 'bg-emerald-500'
  const trackOff = variant === 'red-green' ? 'bg-red-500/70' : 'bg-white/[0.1]'
  const glowOn = variant === 'red-green' ? 'shadow-emerald-500/30' : 'shadow-emerald-500/20'
  const h = size === 'sm' ? 'h-[22px] w-[40px]' : 'h-[26px] w-[46px]'
  const dot = size === 'sm' ? 'h-[16px] w-[16px] top-[2px] left-[2px]' : 'h-[20px] w-[20px] top-[3px] left-[3px]'
  const tx = size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[20px]'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex shrink-0 rounded-full transition-all duration-300 focus:outline-none ${h} ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? `${trackOn} shadow-lg ${glowOn}` : trackOff}`}
    >
      <span className={`pointer-events-none absolute rounded-full bg-white shadow-sm transition-all duration-300 ${dot} ${checked ? tx : 'translate-x-0'}`} />
    </button>
  )
}

function PulseDot({ active, color }: { active: boolean; color: 'green' | 'red' }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {active && color === 'green' && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${
        color === 'green'
          ? active ? 'bg-emerald-400' : 'bg-white/20'
          : active ? 'bg-emerald-400' : 'bg-red-400'
      }`} />
    </span>
  )
}

function ClienteCard({ task }: { task: Task }) {
  const updateTask = useUpdateTask()
  const [editingDate, setEditingDate] = useState(false)

  const initial = task.title.charAt(0).toUpperCase()
  const isPending = updateTask.isPending

  function toggleAds(v: boolean) {
    updateTask.mutate({ id: task.id, adsAtivo: v })
  }

  function togglePromo(v: boolean) {
    updateTask.mutate({ id: task.id, promocaoAtiva: v, promocaoAte: v ? task.promocaoAte : null })
    if (v) setEditingDate(true)
  }

  function saveDate(date: string) {
    updateTask.mutate({ id: task.id, promocaoAte: date || null })
  }

  const promoDate = task.promocaoAte ? new Date(task.promocaoAte) : null
  const promoExpired = promoDate ? promoDate < new Date() : false
  const promoDateStr = promoDate
    ? promoDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null

  return (
    <div
      className="group relative rounded-xl p-4 space-y-3 nm-card-hover"
      style={{
        background: 'var(--nm-bg)',
        boxShadow: '-3px -3px 8px var(--nm-light), 3px 3px 8px var(--nm-dark)',
        border: '1px solid var(--nm-border)',
        transition: 'box-shadow 0.18s ease, transform 0.15s ease',
      }}
    >
      {isPending && (
        <div className="absolute inset-0 rounded-xl bg-black/20 flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
        </div>
      )}

      {/* Name */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 bg-white/[0.06] ring-1 ring-white/[0.08] text-slate-300">
          {initial}
        </div>
        <span className="text-sm font-semibold text-white truncate">{task.title}</span>
      </div>

      <div className="h-px bg-white/[0.05]" />

      {/* ADS row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PulseDot active={task.adsAtivo} color="red" />
          <span className="text-xs text-slate-400 font-medium">ADS</span>
          <span className={`text-[10px] font-medium ${task.adsAtivo ? 'text-emerald-500' : 'text-red-500'}`}>
            {task.adsAtivo ? 'ativo' : 'inativo'}
          </span>
        </div>
        <Toggle checked={task.adsAtivo} onChange={toggleAds} variant="red-green" size="sm" disabled={isPending} />
      </div>

      {/* Promoção row */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PulseDot active={task.promocaoAtiva} color="green" />
            <span className="text-xs text-slate-400 font-medium">Promoção</span>
            {task.promocaoAtiva && promoDateStr && !editingDate && (
              <button
                onClick={() => setEditingDate(true)}
                className={`text-[10px] cursor-pointer transition-colors ${
                  promoExpired
                    ? 'text-red-400 hover:text-red-300'
                    : 'text-amber-500 hover:text-amber-400'
                }`}
              >
                {promoExpired ? `venceu ${promoDateStr}` : `até ${promoDateStr}`}
              </button>
            )}
          </div>
          <Toggle checked={task.promocaoAtiva} onChange={togglePromo} size="sm" disabled={isPending} />
        </div>

        {task.promocaoAtiva && (editingDate || !promoDateStr) && (
          <div className="pl-4 border-l-2 border-emerald-500/20">
            <Input
              type="date"
              defaultValue={task.promocaoAte ? task.promocaoAte.slice(0, 10) : ''}
              onChange={(e) => saveDate(e.target.value)}
              onBlur={() => setEditingDate(false)}
              autoFocus={editingDate}
              className="bg-white/[0.04] border-white/[0.08] text-white [color-scheme:dark] rounded-lg h-8 text-xs"
            />
          </div>
        )}
      </div>
    </div>
  )
}

interface KanbanColProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  count: number
  colorClass: string
  borderClass: string
  children: React.ReactNode
  emptyText: string
}

function KanbanCol({ title, subtitle, icon, count, colorClass, borderClass, children, emptyText }: KanbanColProps) {
  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden"
      style={{
        background: 'var(--nm-bg)',
        boxShadow: '-8px -8px 18px var(--nm-light), 8px 8px 18px var(--nm-dark)',
        border: '1px solid var(--nm-border)',
      }}
    >
      <div className="px-4 py-3.5 flex items-center gap-3" style={{ borderBottom: '1px solid var(--nm-border)' }}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ring-1 shrink-0 ${colorClass}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">{title}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xs font-semibold text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-full shrink-0">
          {count}
        </span>
      </div>
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto max-h-[calc(100vh-220px)]">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-xs text-slate-600">{emptyText}</p>
          </div>
        ) : children}
      </div>
    </div>
  )
}

export function ClientesView() {
  const { data: columns, isLoading } = useColumns('kanban')
  const expirePromos = useExpirePromos()

  // Expira promoções vencidas ao carregar a view
  useEffect(() => {
    expirePromos.mutate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const COLUNAS_EXCLUIDAS = ['encerrado', 'cancelado', 'inativo', 'churned']

  const allTasks: Task[] = columns
    ? columns
        .filter((col) => !COLUNAS_EXCLUIDAS.some((ex) => col.title.toLowerCase().includes(ex)))
        .flatMap((col) => col.tasks)
        .filter((t) => !t.completedAt)
    : []

  const somenteAds   = allTasks.filter((t) => t.adsAtivo && !t.promocaoAtiva)
  const somentePromo = allTasks.filter((t) => t.promocaoAtiva && !t.adsAtivo)
  const osDois       = allTasks.filter((t) => t.adsAtivo && t.promocaoAtiva)
  const semNenhum    = allTasks.filter((t) => !t.adsAtivo && !t.promocaoAtiva)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto" style={{ background: 'var(--nm-bg)' }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-5">
        <div>
          <h1 className="text-base font-semibold text-white" style={{ fontFamily: 'var(--font-heading)' }}>PromoADS</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {allTasks.length} clientes do Processos · edite ADS e promoção em cada card
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {somenteAds.length + osDois.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 text-xs text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {somenteAds.length + osDois.length} com ADS
            </div>
          )}
          {somentePromo.length + osDois.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 text-xs text-amber-400 font-medium">
              <Megaphone className="w-3 h-3" />
              {somentePromo.length + osDois.length} em promoção
            </div>
          )}
        </div>
      </div>

      {/* 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <KanbanCol
          title="Somente ADS"
          subtitle="ADS ativo · sem promoção"
          icon={<Zap className="w-4 h-4 text-emerald-400" />}
          count={somenteAds.length}
          colorClass="bg-emerald-500/10 ring-emerald-500/20"
          borderClass="border-emerald-500/15"
          emptyText="Nenhum cliente só com ADS"
        >
          {somenteAds.map((t) => <ClienteCard key={t.id} task={t} />)}
        </KanbanCol>

        <KanbanCol
          title="Somente Promoção"
          subtitle="Promoção ativa · ADS pausado"
          icon={<Megaphone className="w-4 h-4 text-amber-400" />}
          count={somentePromo.length}
          colorClass="bg-amber-500/10 ring-amber-500/20"
          borderClass="border-amber-500/15"
          emptyText="Nenhum cliente só com promoção"
        >
          {somentePromo.map((t) => <ClienteCard key={t.id} task={t} />)}
        </KanbanCol>

        <KanbanCol
          title="Os dois"
          subtitle="ADS + Promoção ativos"
          icon={<Layers className="w-4 h-4 text-blue-400" />}
          count={osDois.length}
          colorClass="bg-blue-500/10 ring-blue-500/20"
          borderClass="border-blue-500/15"
          emptyText="Nenhum cliente com ambos"
        >
          {osDois.map((t) => <ClienteCard key={t.id} task={t} />)}
        </KanbanCol>
      </div>

      {/* Sem ativação */}
      {semNenhum.length > 0 && (
        <div className="mt-6">
          <p className="text-xs text-slate-600 font-medium uppercase tracking-wide mb-3 pl-0.5">
            Sem ativação · {semNenhum.length}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {semNenhum.map((t) => <ClienteCard key={t.id} task={t} />)}
          </div>
        </div>
      )}
    </div>
  )
}
