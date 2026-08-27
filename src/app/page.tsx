'use client'

import { useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { TaskManager } from '@/components/tasks/task-manager'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { MentoriaBoard } from '@/components/mentoria/mentoria-board'
import {
  LayoutDashboard, ClipboardList, LogOut, User, BarChart,
  GraduationCap, Bot, MessageSquare, Calendar, Building2,
  Briefcase, Menu, ChevronLeft, Settings,
} from 'lucide-react'
import { AutomacaoMLView } from '@/components/automacao-ml/automacao-ml-view'
import { KanbanLeads } from '@/components/crm/kanban-leads'
import { WhatsappSettings } from '@/components/crm/whatsapp-settings'
import { AgendaView } from '@/components/agenda/agenda-view'
import { ClientesView } from '@/components/clientes/clientes-view'
import { CarteiraView } from '@/components/clientes/carteira-view'

type ActiveTab = 'kanban' | 'mentoria' | 'clientes' | 'carteira' | 'tasks' | 'dashboard' | 'automacao-ml' | 'crm' | 'agenda'

const OPERACIONAL = [
  { id: 'kanban',    icon: LayoutDashboard, label: 'Processos', color: '#6366f1' },
  { id: 'mentoria',  icon: GraduationCap,   label: 'Mentoria',  color: '#a855f7' },
  { id: 'clientes',  icon: Building2,       label: 'PromoADS',  color: '#f59e0b' },
  { id: 'carteira',  icon: Briefcase,       label: 'Carteira',  color: '#10b981' },
  { id: 'tasks',     icon: ClipboardList,   label: 'Tarefas',   color: '#3b82f6' },
] as const

const COMERCIAL = [
  { id: 'crm',          icon: MessageSquare, label: 'CRM',          color: '#22c55e' },
  { id: 'dashboard',    icon: BarChart,      label: 'Dashboard',    color: '#0ea5e9' },
  { id: 'automacao-ml', icon: Bot,           label: 'Automação ML', color: '#10b981' },
  { id: 'agenda',       icon: Calendar,      label: 'Agenda',       color: '#f97316' },
] as const

export default function HomePage() {
  const [activeTab, setActiveTab]     = useState<ActiveTab>('kanban')
  const [expanded, setExpanded]       = useState(true)
  const [crmOpenLeadId, setCrmOpenLeadId] = useState<string | null>(null)
  const { data: session } = useSession()

  function openLeadInCrm(leadId: string) {
    setCrmOpenLeadId(leadId)
    setActiveTab('crm')
  }

  function NavItem({ id, icon: Icon, label, color }: { id: ActiveTab; icon: React.ElementType; label: string; color: string }) {
    const isActive = activeTab === id
    return (
      <button
        key={id}
        onClick={() => setActiveTab(id)}
        title={!expanded ? label : undefined}
        className={`w-full flex items-center gap-3 rounded-xl transition-all duration-150 cursor-pointer select-none
          ${expanded ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}
          ${isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'}`}
        style={{ backgroundColor: isActive ? `${color}18` : undefined }}
      >
        <Icon
          className="w-[17px] h-[17px] shrink-0 transition-colors"
          style={{ color: isActive ? color : undefined }}
        />
        {expanded && (
          <span className="text-[13px] font-medium truncate leading-none">{label}</span>
        )}
        {isActive && expanded && (
          <span
            className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
      </button>
    )
  }

  function SectionLabel({ label }: { label: string }) {
    if (!expanded) {
      return <div className="my-1 mx-auto w-6 h-px bg-white/[0.08]" />
    }
    return (
      <p className="px-3 pt-1 pb-1 text-[10px] font-semibold tracking-widest uppercase text-slate-600 select-none">
        {label}
      </p>
    )
  }

  return (
    <div className="dark min-h-screen flex bg-[#07080c] text-white relative overflow-hidden">
      {/* Ambient lights */}
      <div className="fixed top-0 left-[20%] w-[500px] h-[300px] rounded-full bg-blue-600/[0.04] blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-[10%] w-[400px] h-[300px] rounded-full bg-indigo-500/[0.03] blur-[140px] pointer-events-none z-0" />

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside
        className="shrink-0 flex flex-col border-r border-white/[0.06] bg-[#08090e] z-40 relative transition-all duration-200"
        style={{ width: expanded ? 220 : 60 }}
      >
        {/* Logo + Toggle */}
        <div className={`flex items-center h-[60px] border-b border-white/[0.06] shrink-0
          ${expanded ? 'px-4 gap-3' : 'justify-center'}`}>
          {expanded && (
            <div className="flex items-center gap-1 select-none flex-1 min-w-0">
              <span className="text-lg font-medium tracking-tight text-amber-400 lowercase">melo</span>
              <span className="text-lg font-light italic tracking-tight text-slate-300 lowercase">flow</span>
            </div>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
            title={expanded ? 'Recolher menu' : 'Expandir menu'}
          >
            {expanded ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
          <SectionLabel label="Operacional" />
          {OPERACIONAL.map(item => (
            <NavItem key={item.id} {...item} id={item.id as ActiveTab} />
          ))}

          <div className="pt-3">
            <SectionLabel label="Comercial" />
          </div>
          {COMERCIAL.map(item => (
            <NavItem key={item.id} {...item} id={item.id as ActiveTab} />
          ))}
        </nav>

        {/* Footer do sidebar */}
        <div className="shrink-0 border-t border-white/[0.06] py-3 px-2 space-y-1">
          {/* WhatsApp Settings */}
          <div className={`flex ${expanded ? '' : 'justify-center'}`}>
            <WhatsappSettings collapsed={!expanded} />
          </div>

          {/* Usuário */}
          {session?.user && (
            <div className={`flex items-center gap-2.5 rounded-xl px-2 py-2 ${expanded ? '' : 'justify-center'}`}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-500/30 flex items-center justify-center ring-1 ring-white/10 shrink-0">
                <User className="w-3.5 h-3.5 text-blue-300" />
              </div>
              {expanded && (
                <span className="text-[12px] text-slate-400 font-medium truncate flex-1 min-w-0">
                  {session.user.name}
                </span>
              )}
            </div>
          )}

          {/* Logout */}
          <button
            onClick={() => signOut()}
            title="Sair"
            className={`w-full flex items-center gap-2.5 rounded-xl px-2 py-2 text-slate-600 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer
              ${expanded ? '' : 'justify-center'}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {expanded && <span className="text-[12px] font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
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
