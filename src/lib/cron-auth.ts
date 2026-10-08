import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

/**
 * Aceita usuário logado (disparo manual pela interface), o Vercel Cron ou
 * qualquer chamada fora de produção. O Vercel Cron só se autentica via
 * `Authorization: Bearer <CRON_SECRET>` (enviado automaticamente quando a env
 * CRON_SECRET existe no projeto) — não existe header de assinatura, então
 * sem CRON_SECRET o cron recebe 401.
 */
export async function isCronRequestAuthorized(request: Request): Promise<boolean> {
  if (CRON_SECRET && request.headers.get('authorization') === `Bearer ${CRON_SECRET}`) return true
  if (process.env.NODE_ENV !== 'production') return true
  return Boolean(await getServerSession(authOptions))
}
