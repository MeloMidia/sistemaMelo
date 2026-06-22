'use client'

import { useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { TaskManager } from '@/components/tasks/task-manager'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { MentoriaBoard } from '@/components/mentoria/mentoria-board'
import { LayoutDashboard, ClipboardList, LogOut, User, BarChart, GraduationCap, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AutomacaoMLView } from '@/components/automacao-ml/automacao-ml-view'

type ActiveTab = 'kanban' | 'mentoria' | 'tasks' | 'dashboard' | 'automacao-ml'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('kanban')
  const { data: session } = useSession()

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
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                SistemaMelo
              </span>
            </div>

            {/* Tabs */}
            <nav className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <button
                onClick={() => setActiveTab('kanban')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
                  ${activeTab === 'kanban'
                    ? 'bg-gradient-to-r from-blue-600/90 to-indigo-600/90 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }
                `}
              >
                <LayoutDashboard className="w-4 h-4" />
                Processos
              </button>
              <button
                onClick={() => setActiveTab('mentoria')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
                  ${activeTab === 'mentoria'
                    ? 'bg-gradient-to-r from-purple-600/90 to-fuchsia-600/90 text-white shadow-lg shadow-purple-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }
                `}
              >
                <GraduationCap className="w-4 h-4" />
                Mentoria
              </button>
              <button
                onClick={() => setActiveTab('tasks')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
                  ${activeTab === 'tasks'
                    ? 'bg-gradient-to-r from-blue-600/90 to-indigo-600/90 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }
                `}
              >
                <ClipboardList className="w-4 h-4" />
                Gestão de Tarefas
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
                  ${activeTab === 'dashboard'
                    ? 'bg-gradient-to-r from-blue-600/90 to-indigo-600/90 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }
                `}
              >
                <BarChart className="w-4 h-4" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('automacao-ml')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
                  ${activeTab === 'automacao-ml'
                    ? 'bg-gradient-to-r from-emerald-600/90 to-teal-600/90 text-white shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }
                `}
              >
                <Bot className="w-4 h-4" />
                Automação ML
              </button>
            </nav>
          </div>

          {/* User area */}
          <div className="flex items-center gap-3">
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
        {activeTab === 'kanban' && <KanbanBoard />}
        {activeTab === 'mentoria' && <MentoriaBoard />}
        {activeTab === 'tasks' && <TaskManager />}
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'automacao-ml' && <AutomacaoMLView />}
      </main>
    </div>
  )
}
