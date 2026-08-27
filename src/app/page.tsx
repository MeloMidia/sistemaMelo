'use client'

import { useState, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { TaskManager } from '@/components/tasks/task-manager'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { MentoriaBoard } from '@/components/mentoria/mentoria-board'
import {
  LayoutDashboard, ClipboardList, LogOut, User, BarChart,
  GraduationCap, Bot, MessageSquare, Calendar, Building2,
  Briefcase, Menu, ChevronLeft, Sun, Moon,
} from 'lucide-react'
import { AutomacaoMLView } from '@/components/automacao-ml/automacao-ml-view'
import { KanbanLeads } from '@/components/crm/kanban-leads'
import { WhatsappSettings } from '@/components/crm/whatsapp-settings'
import { AgendaView } from '@/components/agenda/agenda-view'
import { ClientesView } from '@/components/clientes/clientes-view'
import { CarteiraView } from '@/components/clientes/carteira-view'

type ActiveTab = 'kanban' | 'mentoria' | 'clientes' | 'carteira' | 'tasks' | 'dashboard' | 'automacao-ml' | 'crm' | 'agenda'

const OPERACIONAL = [
  { id: 'kanban',   icon: LayoutDashboard, label: 'Processos', color: '#6366f1' },
  { id: 'mentoria', icon: GraduationCap,   label: 'Mentoria',  color: '#a855f7' },
  { id: 'clientes', icon: Building2,       label: 'PromoADS',  color: '#f59e0b' },
  { id: 'carteira', icon: Briefcase,       label: 'Carteira',  color: '#10b981' },
  { id: 'tasks',    icon: ClipboardList,   label: 'Tarefas',   color: '#3b82f6' },
] as const

const COMERCIAL = [
  { id: 'crm',          icon: MessageSquare, label: 'CRM',          color: '#22c55e' },
  { id: 'dashboard',    icon: BarChart,      label: 'Dashboard',    color: '#0ea5e9' },
  { id: 'automacao-ml', icon: Bot,           label: 'Automação ML', color: '#10b981' },
  { id: 'agenda',       icon: Calendar,      label: 'Agenda',       color: '#f97316' },
] as const

export default function HomePage() {
  const [activeTab, setActiveTab]         = useState<ActiveTab>('kanban')
  const [expanded, setExpanded]           = useState(true)
  const [crmOpenLeadId, setCrmOpenLeadId] = useState<string | null>(null)
  const [theme, setTheme]                 = useState<'dark' | 'light'>('dark')
  const { data: session } = useSession()

  // Persistir tema no localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nm-theme') as 'dark' | 'light' | null
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch {}
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem('nm-theme', next) } catch {}
  }

  function openLeadInCrm(leadId: string) {
    setCrmOpenLeadId(leadId)
    setActiveTab('crm')
  }

  // Neumorphic nav item — pressed when active, raised when hovered
  function NavItem({
    id, icon: Icon, label, color,
  }: { id: ActiveTab; icon: React.ElementType; label: string; color: string }) {
    const isActive = activeTab === id
    return (
      <button
        onClick={() => setActiveTab(id)}
        title={!expanded ? label : undefined}
        className={`w-full flex items-center gap-3 rounded-xl cursor-pointer select-none transition-all duration-200
          ${expanded ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}`}
        style={{
          background: 'var(--nm-bg)',
          boxShadow: isActive
            ? 'inset -3px -3px 8px var(--nm-light), inset 3px 3px 8px var(--nm-dark)'
            : undefined,
          color: isActive ? color : 'var(--nm-text-secondary)',
        }}
        onMouseEnter={e => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.boxShadow =
              '-3px -3px 8px var(--nm-light), 3px 3px 8px var(--nm-dark)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--nm-text-primary)'
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            ;(e.currentTarget as HTMLElement).style.boxShadow = ''
            ;(e.currentTarget as HTMLElement).style.color = 'var(--nm-text-secondary)'
          }
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

  function SectionLabel({ label }: { label: string }) {
    if (!expanded) return <div className="my-2 mx-auto w-5 h-px" style={{ background: 'var(--nm-border)' }} />
    return (
      <p className="px-3 pt-2 pb-1.5 text-[9px] font-bold tracking-[0.15em] uppercase select-none"
        style={{ color: 'var(--nm-text-muted)' }}>
        {label}
      </p>
    )
  }

  const pageBg = theme === 'light' ? 'var(--nm-surface)' : 'var(--nm-bg)'

  return (
    <div
      data-theme={theme}
      className="dark min-h-screen flex overflow-hidden"
      style={{ background: pageBg }}
    >
      {/* Ambient glow — subtle, not dominant */}
      <div className="fixed top-[-80px] left-[15%] w-[400px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #6366f108 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-60px] right-[8%] w-[350px] h-[250px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #a855f706 0%, transparent 70%)' }} />

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className="nm-sidebar shrink-0 flex flex-col z-40 relative transition-all duration-200"
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
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  boxShadow: '0 2px 8px #6366f140',
                  color: '#fff',
                }}
              >
                M
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
          <SectionLabel label="Operacional" />
          {OPERACIONAL.map(item => (
            <NavItem key={item.id} {...item} id={item.id as ActiveTab} />
          ))}

          <div className="pt-2">
            <SectionLabel label="Comercial" />
          </div>
          {COMERCIAL.map(item => (
            <NavItem key={item.id} {...item} id={item.id as ActiveTab} />
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
                style={{ color: '#6366f1' }}
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
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0"
        style={{ background: pageBg }}>
        {activeTab === 'kanban'       && <KanbanBoard />}
        {activeTab === 'mentoria'     && <MentoriaBoard />}
        {activeTab === 'clientes'     && <ClientesView />}
        {activeTab === 'carteira'     && <CarteiraView />}
        {activeTab === 'tasks'        && <TaskManager />}
        {activeTab === 'dashboard'    && <DashboardView />}
        {activeTab === 'automacao-ml' && <AutomacaoMLView />}
        {activeTab === 'crm'          && <KanbanLeads openLeadId={crmOpenLeadId} />}
        {activeTab === 'agenda'       && <AgendaView onOpenLeadInCrm={openLeadInCrm} />}
      </main>
    </div>
  )
}
