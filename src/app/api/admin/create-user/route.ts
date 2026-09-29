import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * Rota de uso único: cria/atualiza um usuário de login direto no banco que a
 * própria Vercel está usando em produção (evita depender do DATABASE_URL
 * local, que pode estar desatualizado em relação à credencial real).
 * Protegida por sessão — só funciona pra quem já está logado.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim()
  const login = searchParams.get('login')?.trim()
  const password = searchParams.get('password')

  if (!name || !login || !password) {
    return NextResponse.json({ error: 'Informe name, login e password na URL.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.upsert({
    where: { email: login },
    update: { name, passwordHash },
    create: { name, email: login, passwordHash },
  })

  return NextResponse.json({ id: user.id, name: user.name, login: user.email })
}
