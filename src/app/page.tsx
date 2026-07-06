'use client'

import { useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { TaskManager } from '@/components/tasks/task-manager'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { MentoriaBoard } from '@/components/mentoria/mentoria-board'
import { LayoutDashboard, ClipboardList, LogOut, User, BarChart, GraduationCap, Bot, MessageSquare, Calendar, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AutomacaoMLView } from '@/components/automacao-ml/automacao-ml-view'
import { KanbanLeads } from '@/components/crm/kanban-leads'
import { WhatsappSettings } from '@/components/crm/whatsapp-settings'
import { AgendaView } from '@/components/agenda/agenda-view'
import { ClientesView } from '@/components/clientes/clientes-view'

type ActiveTab = 'kanban' | 'mentoria' | 'clientes' | 'tasks' | 'dashboard' | 'automacao-ml' | 'crm' | 'agenda'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('kanban')
  const [crmOpenLeadId, setCrmOpenLeadId] = useState<string | null>(null)
  const { data: session } = useSession()

  function openLeadInCrm(leadId: string) {
    setCrmOpenLeadId(leadId)
    setActiveTab('crm')
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#07080c] text-white relative">
      {/* Subtle ambient lights */}
      <div className="fixed top-0 left-[20%] w-[500px] h-[300px] rounded-full bg-blue-600/[0.04] blur-[140px] pointer-events-none" />
      <div className="fixed bottom-0 right-[10%] w-[400px] h-[300px] rounded-full bg-indigo-500/[0.03] blur-[140px] pointer-events-none" />

      {/* Header / Navbar */}
      <header className="shrink-0 border-b border-white/[0.06] bg-[#07080c]/70 backdrop-blur-2xl sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 h-[60px]">
          {/* Logo + Nav */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-1 select-none">
              <span className="text-xl font-medium tracking-tight text-amber-400 lowercase">melo</span>
              <span className="text-xl font-light italic tracking-tight text-slate-300 lowercase">flow</span>
            </div>

            {/* Tabs */}
            <nav className="flex items-center gap-0.5">
              {([
                { id: 'kanban',       icon: LayoutDashboard, label: 'Processos',    color: '#6366f1' },
                { id: 'mentoria',     icon: GraduationCap,   label: 'Mentoria',     color: '#a855f7' },
                { id: 'clientes',     icon: Building2,       label: 'PromoADS',     color: '#f59e0b' },
                { id: 'tasks',        icon: ClipboardList,   label: 'Tarefas',      color: '#3b82f6' },
                { id: 'dashboard',    icon: BarChart,        label: 'Dashboard',    color: '#0ea5e9' },
                { id: 'automacao-ml', icon: Bot,             label: 'Automação ML', color: '#10b981' },
                { id: 'crm',          icon: MessageSquare,   label: 'CRM',          color: '#22c55e' },
                { id: 'agenda',       icon: Calendar,        label: 'Agenda',       color: '#f97316' },
              ] as const).map(({ id, icon: Icon, label, color }) => {
                const isActive = activeTab === id
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-150 ${
                      isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                    }`}
                    style={{ backgroundColor: isActive ? `${color}15` : undefined }}
                  >
                    <Icon
                      className="w-[15px] h-[15px] transition-colors"
                      style={{ color: isActive ? color : undefined }}
                    />
                    <span>{label}</span>
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* User area */}
          <div className="flex items-center gap-3">
            <WhatsappSettings />
            {session?.user && (
              <div className="flex items-center gap-2.5 text-sm">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-500/30 flex items-center justify-center ring-1 ring-white/10">
                  <User className="w-4 h-4 text-blue-300" />
                </div>
                <span className="hidden sm:inline text-slate-300 font-medium">{session.user.name}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="text-slate-500 hover:text-white hover:bg-white/[0.06] cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab === 'kanban'       && <KanbanBoard />}
        {activeTab === 'mentoria'     && <MentoriaBoard />}
        {activeTab === 'clientes'     && <ClientesView />}
        {activeTab === 'tasks'        && <TaskManager />}
        {activeTab === 'dashboard'    && <DashboardView />}
        {activeTab === 'automacao-ml' && <AutomacaoMLView />}
        {activeTab === 'crm'          && <KanbanLeads openLeadId={crmOpenLeadId} />}
        {activeTab === 'agenda'       && <AgendaView onOpenLeadInCrm={openLeadInCrm} />}
      </main>
    </div>
  )
}
