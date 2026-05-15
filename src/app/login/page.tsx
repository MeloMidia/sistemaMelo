'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LayoutDashboard, AlertCircle, Lock, User } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (res?.error) {
      setError('Login ou senha inválidos.')
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-[#07080c] relative overflow-hidden">
      {/* Ambient light blobs */}
      <div className="absolute top-[-30%] left-[-15%] w-[700px] h-[700px] rounded-full bg-blue-600/[0.07] blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-25%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500/[0.06] blur-[160px] pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] rounded-full bg-cyan-500/[0.04] blur-[120px] pointer-events-none" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      <Card className="w-full max-w-[420px] mx-4 bg-white/[0.03] border-white/[0.08] backdrop-blur-2xl shadow-2xl shadow-black/40 relative overflow-hidden">
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

        <CardHeader className="text-center space-y-5 pb-2 pt-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/25 ring-1 ring-white/10">
            <LayoutDashboard className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              SistemaMelo
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1.5 text-sm">
              Gestão de tarefas interna
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-6 pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300 text-sm font-medium">
                Login / Usuário
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="email"
                  type="text"
                  placeholder="Seu login"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-blue-500/20 h-12 pl-10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-blue-500/20 h-12 pl-10 rounded-xl"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold border-0 shadow-lg shadow-blue-600/25 rounded-xl cursor-pointer text-[15px]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <p className="text-center text-slate-600 text-xs mt-6">
            Acesso restrito à equipe interna
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
