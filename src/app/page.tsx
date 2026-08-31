'use client'

import { useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { TaskManager } from '@/components/tasks/task-manager'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { MentoriaBoard } from '@/components/mentoria/mentoria-board'
import {
  LayoutDashboard, ClipboardList, LogOut, User, BarChart, Users,
  GraduationCap, Bot, MessageSquare, Calendar, Building2,
  Briefcase, Kanban, Menu, ChevronLeft, Sun, Moon,
} from 'lucide-react'
import { AutomacaoMLView } from '@/components/automacao-ml/automacao-ml-view'
import { ClientesMetricas } from '@/components/clientes/clientes-metricas'
import { CrmInbox, type CrmView } from '@/components/crm/crm-inbox'
import { WhatsappSettings } from '@/components/crm/whatsapp-settings'
import { AgendaView } from '@/components/agenda/agenda-view'
import { ClientesView } from '@/components/clientes/clientes-view'
import { CarteiraView } from '@/components/clientes/carteira-view'

type ActiveTab = 'kanban' | 'mentoria' | 'clientes' | 'carteira' | 'tasks' | 'automacao-ml' | 'metricas' | 'dashboard' | 'crm' | 'agenda'

const OPERACIONAL = [
  { id: 'kanban',       icon: LayoutDashboard, label: 'Processos',    color: '#2854DF' },
  { id: 'mentoria',     icon: GraduationCap,   label: 'Mentoria',     color: '#2854DF' },
  { id: 'clientes',     icon: Building2,       label: 'PromoADS',     color: '#2854DF' },
  { id: 'carteira',     icon: Briefcase,       label: 'Carteira',     color: '#2854DF' },
  { id: 'tasks',        icon: ClipboardList,   label: 'Tarefas',      color: '#2854DF' },
  { id: 'automacao-ml', icon: Bot,             label: 'Automação ML', color: '#06b6d4' },
] as const

const COMERCIAL = [
  { id: 'crm',       icon: MessageSquare, label: 'CRM',       color: '#22c55e' },
  { id: 'dashboard', icon: BarChart,      label: 'Dashboard', color: '#0ea5e9' },
  { id: 'metricas',  icon: Users,         label: 'Métricas',  color: '#a855f7' },
  { id: 'agenda',    icon: Calendar,      label: 'Agenda',    color: '#f97316' },
] as const

function SectionLabel({ label, expanded }: { label: string; expanded: boolean }) {
  if (!expanded) return <div className="my-2 mx-auto w-5 h-px" style={{ background: 'var(--nm-border)' }} />
  return (
    <p className="px-3 pt-2 pb-1.5 text-[9px] font-bold tracking-[0.15em] uppercase select-none"
      style={{ color: 'var(--nm-text-muted)' }}>
      {label}
    </p>
  )
}

export default function HomePage() {
  const [activeTab, setActiveTab]         = useState<ActiveTab>('kanban')
  const [expanded, setExpanded]           = useState(true)
  const [crmOpenLeadId, setCrmOpenLeadId] = useState<string | null>(null)
  const [crmView, setCrmView]             = useState<CrmView>('inbox')
  const [theme, setTheme]                 = useState<'dark' | 'light'>('light')
  const { data: session } = useSession()

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem('nm-theme', next) } catch {}
  }

  function openLeadInCrm(leadId: string) {
    setCrmOpenLeadId(leadId)
    setCrmView('inbox')
    setActiveTab('crm')
  }

  function openCrmKanban() {
    setCrmView('pipeline')
    setActiveTab('crm')
  }

  // Neumorphic nav item — pressed when active, raised when hovered
  function NavItem({
    id, icon: Icon, label, color,
  }: { id: ActiveTab; icon: React.ElementType; label: string; color: string }) {
    const isActive = activeTab === id
    return (
      <button
        onClick={() => {
          if (id === 'crm') setCrmView('inbox')
          setActiveTab(id)
        }}
        title={!expanded ? label : undefined}
        className={`mf-nav-item w-full flex items-center gap-3 rounded-xl cursor-pointer select-none transition-colors duration-150
          ${isActive ? 'mf-nav-item-active' : ''} ${expanded ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}`}
        style={{
          color: isActive ? color : 'var(--nm-text-secondary)',
        }}
      >
        <Icon
          className="w-[17px] h-[17px] shrink-0 transition-colors"
          style={{ color: isActive ? color : 'inherit' }}
        />
        {expanded && (
          <span
            className="text-[13px] font-semibold truncate leading-none"
            style={{ color: isActive ? 'var(--nm-text-primary)' : 'inherit' }}
          >
            {label}
          </span>
        )}
        {isActive && expanded && (
          <span
            className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
          />
        )}
      </button>
    )
  }

  const pageBg = 'var(--mf-paper)'

  return (
    <div
      data-theme={theme}
      className="h-dvh min-h-0 flex overflow-hidden mf-app-shell"
      style={{ background: pageBg }}
    >
      {/* Ambient glow — matiz índigo/navy */}
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className="nm-sidebar mf-sidebar shrink-0 min-h-0 flex flex-col z-40 relative transition-[width] duration-200"
        style={{ width: expanded ? 220 : 64 }}
      >
        {/* Logo + toggle */}
        <div
          className={`flex items-center h-16 shrink-0 ${expanded ? 'px-4 gap-3' : 'justify-center'}`}
          style={{ borderBottom: '1px solid var(--nm-border)' }}
        >
          {expanded && (
            <div className="flex items-center gap-1.5 select-none flex-1 min-w-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                style={{
                  background: '#151817',
                  boxShadow: 'none',
                  color: '#fff',
                }}
              >
                MF
              </div>
              <div>
                <span className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--nm-text-primary)' }}>
                  melo
                </span>
                <span className="text-[15px] font-light italic tracking-tight" style={{ color: 'var(--nm-text-secondary)' }}>
                  flow
                </span>
              </div>
            </div>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer nm-btn shrink-0"
            title={expanded ? 'Recolher' : 'Expandir'}
            style={{ color: 'var(--nm-text-muted)' }}
          >
            {expanded
              ? <ChevronLeft className="w-4 h-4" />
              : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
          <SectionLabel label="Operacional" expanded={expanded} />
          {OPERACIONAL.map(item => (
            <NavItem key={item.id} {...item} id={item.id as ActiveTab} />
          ))}

          <div className="pt-2">
            <SectionLabel label="Comercial" expanded={expanded} />
          </div>
          {COMERCIAL.map(item => (
            <div key={item.id}>
              <NavItem {...item} id={item.id as ActiveTab} />
              {item.id === 'crm' && expanded && (
                <button
                  type="button"
                  onClick={openCrmKanban}
                  className={`mf-nav-subitem ${activeTab === 'crm' && crmView === 'pipeline' ? 'mf-nav-subitem-active' : ''}`}
                  aria-current={activeTab === 'crm' && crmView === 'pipeline' ? 'page' : undefined}
                >
                  <Kanban className="size-3.5 shrink-0" aria-hidden="true" />
                  Kanban
                </button>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="shrink-0 py-3 px-2 space-y-1"
          style={{ borderTop: '1px solid var(--nm-border)' }}
        >
          {/* WhatsApp */}
          <div className={`flex ${expanded ? '' : 'justify-center'}`}>
            <WhatsappSettings collapsed={!expanded} />
          </div>

          {/* Usuário */}
          {session?.user && (
            <div className={`flex items-center gap-2.5 px-2 py-2 rounded-xl ${expanded ? '' : 'justify-center'}`}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 nm-xs"
              style={{ color: 'var(--mf-signal)' }}
              >
                <User className="w-3.5 h-3.5" />
              </div>
              {expanded && (
                <span className="text-[12px] font-medium truncate flex-1 min-w-0" style={{ color: 'var(--nm-text-secondary)' }}>
                  {session.user.name}
                </span>
              )}
            </div>
          )}

          {/* Tema claro / escuro */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className={`w-full flex items-center gap-2.5 rounded-xl px-2 py-2 cursor-pointer transition-all duration-200 nm-btn
              ${expanded ? '' : 'justify-center'}`}
            style={{ color: 'var(--nm-text-secondary)' }}
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4 shrink-0" />
              : <Moon className="w-4 h-4 shrink-0" />}
            {expanded && (
              <span className="text-[12px] font-medium">
                {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
              </span>
            )}
          </button>

          {/* Sair */}
          <button
            onClick={() => signOut()}
            title="Sair"
            className={`w-full flex items-center gap-2.5 rounded-xl px-2 py-2 cursor-pointer transition-colors
              ${expanded ? '' : 'justify-center'}`}
            style={{ color: 'var(--nm-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--nm-text-muted)' }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {expanded && <span className="text-[12px] font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="mf-main flex-1 min-h-0 flex flex-col overflow-hidden relative min-w-0"
        style={{ background: pageBg }}>
        {activeTab === 'kanban'       && <KanbanBoard />}
        {activeTab === 'mentoria'     && <MentoriaBoard />}
        {activeTab === 'clientes'     && <ClientesView />}
        {activeTab === 'carteira'     && <CarteiraView />}
        {activeTab === 'tasks'        && <TaskManager />}
        {activeTab === 'dashboard'    && <DashboardView />}
        {activeTab === 'metricas'     && <ClientesMetricas />}
        {activeTab === 'automacao-ml' && <AutomacaoMLView />}
        {activeTab === 'crm'          && <CrmInbox openLeadId={crmOpenLeadId} view={crmView} onViewChange={setCrmView} />}
        {activeTab === 'agenda'       && <AgendaView onOpenLeadInCrm={openLeadInCrm} />}
      </main>
    </div>
  )
}
