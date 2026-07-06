'use client'

import { useState } from 'react'
import { Building2, Plus, Megaphone, Trash2, TrendingUp, Zap, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ClienteItem {
  id: string
  nome: string
  promocaoAtiva: boolean
  promocaoAte: string
  adsAtivo: boolean
}

function Toggle({
  checked,
  onChange,
  variant = 'green',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  variant?: 'green' | 'red-green'
}) {
  const trackOn = 'bg-emerald-500'
  const trackOff = variant === 'red-green' ? 'bg-red-500/70' : 'bg-white/[0.08]'
  const glowOn = variant === 'red-green' ? 'shadow-emerald-500/40' : 'shadow-emerald-500/30'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
        checked ? `${trackOn} shadow-lg ${glowOn}` : trackOff
      }`}
    >
      <span
        className={`pointer-events-none absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function PulseDot({ active, color }: { active: boolean; color: 'green' | 'red' }) {
  if (color === 'green') {
    return (
      <span className="relative flex h-2 w-2">
        {active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${active ? 'bg-emerald-400' : 'bg-white/20'}`} />
      </span>
    )
  }
  return (
    <span className="relative flex h-2 w-2">
      <span className={`relative inline-flex rounded-full h-2 w-2 ${active ? 'bg-emerald-400' : 'bg-red-400'}`} />
    </span>
  )
}

function ClienteCard({ c, onRemove }: { c: ClienteItem; onRemove: () => void }) {
  const initial = c.nome.charAt(0).toUpperCase()
  const borderColor = c.adsAtivo ? 'border-emerald-500/20 hover:border-emerald-500/40' : 'border-white/[0.06] hover:border-white/[0.12]'
  const shadow = c.adsAtivo ? 'hover:shadow-emerald-500/10' : ''

  return (
    <div
      className={`group relative rounded-2xl border ${borderColor} bg-white/[0.03] backdrop-blur-sm p-5 space-y-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${shadow} cursor-default`}
    >
      {/* Delete button */}
      <button
        onClick={onRemove}
        className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 opacity-0 group-hover:opacity-100 cursor-pointer"
        aria-label="Remover empresa"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          c.adsAtivo
            ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/30 text-emerald-300'
            : 'bg-white/[0.06] ring-1 ring-white/[0.08] text-slate-300'
        }`}>
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{c.nome}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {c.adsAtivo ? 'ADS rodando' : 'ADS pausado'}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.04]" />

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {/* ADS */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          c.adsAtivo
            ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
            : 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
        }`}>
          <PulseDot active={c.adsAtivo} color="red" />
          <Zap className="w-3 h-3" />
          ADS {c.adsAtivo ? 'ativo' : 'inativo'}
        </div>

        {/* Promoção */}
        {c.promocaoAtiva ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
            <Megaphone className="w-3 h-3" />
            {c.promocaoAte
              ? `até ${new Date(c.promocaoAte + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
              : 'Promoção ativa'}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.03] text-slate-500 ring-1 ring-white/[0.06]">
            <Megaphone className="w-3 h-3" />
            Sem promoção
          </div>
        )}
      </div>
    </div>
  )
}

export function ClientesView() {
  const [clientes, setClientes] = useState<ClienteItem[]>([])
  const [nome, setNome] = useState('')
  const [promocaoAtiva, setPromocaoAtiva] = useState(false)
  const [promocaoAte, setPromocaoAte] = useState('')
  const [adsAtivo, setAdsAtivo] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setClientes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nome: nome.trim(), promocaoAtiva, promocaoAte, adsAtivo },
    ])
    setNome('')
    setPromocaoAtiva(false)
    setPromocaoAte('')
    setAdsAtivo(false)
  }

  const adsAtivos = clientes.filter((c) => c.adsAtivo).length
  const promoAtivas = clientes.filter((c) => c.promocaoAtiva).length

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[500px]">

        {/* ─── Left panel: Form ─── */}
        <div className="flex flex-col gap-0 rounded-2xl border border-white/[0.07] bg-[#0a0c14] overflow-hidden">
          {/* Gradient top strip */}
          <div className="h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

          <div className="p-6 space-y-6 flex-1">
            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-600/15 flex items-center justify-center ring-1 ring-amber-500/25 shadow-lg shadow-amber-500/10">
                  <Building2 className="w-4.5 h-4.5 text-amber-400" style={{ width: 18, height: 18 }} />
                </div>
                <h2 className="text-base font-semibold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                  Nova Empresa
                </h2>
              </div>
              <p className="text-xs text-slate-500 pl-12">Cadastre e monitore seus clientes</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="clienteNome" className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                  Nome da empresa
                </Label>
                <Input
                  id="clienteNome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Melo Mídia..."
                  required
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 rounded-xl h-11 focus:border-amber-500/40 focus:ring-amber-500/20 transition-colors"
                />
              </div>

              {/* Divider */}
              <div className="h-px bg-white/[0.05]" />

              {/* Switch: Promoção */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <PulseDot active={promocaoAtiva} color="green" />
                    <span className="text-sm text-slate-300 font-medium select-none">Promoção</span>
                  </div>
                  <Toggle checked={promocaoAtiva} onChange={setPromocaoAtiva} />
                </div>

                {promocaoAtiva && (
                  <div className="ml-4 pl-4 border-l-2 border-emerald-500/20 space-y-1.5">
                    <Label htmlFor="promocaoAte" className="text-[11px] text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      Promoção até
                    </Label>
                    <Input
                      id="promocaoAte"
                      type="date"
                      value={promocaoAte}
                      onChange={(e) => setPromocaoAte(e.target.value)}
                      className="bg-white/[0.04] border-white/[0.08] text-white [color-scheme:dark] rounded-xl h-10 text-sm focus:border-emerald-500/40"
                    />
                  </div>
                )}
              </div>

              {/* Switch: ADS */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <PulseDot active={adsAtivo} color="red" />
                  <div>
                    <span className="text-sm text-slate-300 font-medium select-none">ADS</span>
                    <span className="block text-[10px] text-slate-600">
                      {adsAtivo ? 'Campanha ativa' : 'Campanha pausada'}
                    </span>
                  </div>
                </div>
                <Toggle checked={adsAtivo} onChange={setAdsAtivo} variant="red-green" />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!nome.trim()}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
                  bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400
                  shadow-lg shadow-amber-600/25 hover:shadow-amber-500/40 hover:scale-[1.01]
                  flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Empresa
              </button>
            </form>
          </div>
        </div>

        {/* ─── Right area: Cards ─── */}
        <div className="lg:col-span-3 flex flex-col rounded-2xl border border-white/[0.07] bg-[#0a0c14] overflow-hidden">
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <div className="p-6 flex flex-col flex-1">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/10 flex items-center justify-center ring-1 ring-blue-500/20 shadow-lg shadow-blue-500/10">
                  <TrendingUp className="w-4.5 h-4.5 text-blue-400" style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                    Empresas
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {clientes.length === 0 ? 'Nenhuma empresa' : `${clientes.length} cadastrada${clientes.length > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              {/* Stats pills */}
              {clientes.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 text-xs text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {adsAtivos} ADS
                  </div>
                  {promoAtivas > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 text-xs text-amber-400 font-medium">
                      <Megaphone className="w-3 h-3" />
                      {promoAtivas} promo
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Empty state */}
            {clientes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.07] flex items-center justify-center mb-4">
                  <Building2 className="w-7 h-7 text-white/10" />
                </div>
                <p className="text-sm text-slate-500 font-medium">Nenhuma empresa cadastrada</p>
                <p className="text-xs text-slate-600 mt-1">Adicione uma empresa no painel ao lado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {clientes.map((c) => (
                  <ClienteCard key={c.id} c={c} onRemove={() => setClientes((p) => p.filter((x) => x.id !== c.id))} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
