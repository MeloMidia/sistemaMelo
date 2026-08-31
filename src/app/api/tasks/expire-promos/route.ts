import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { toDateOnlyString, todayBrazilDateString } from '@/lib/clientes'

export async function POST(_request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // promocaoAte guarda um dia de calendário (meia-noite UTC), não um instante.
  // Comparar direto com `now` (ex: `lt: now`) desativa a promoção ~3h antes da
  // meia-noite do fuso do Brasil, cortando o último dia informado pela metade.
  // Por isso comparamos dia-de-calendário contra o dia atual no fuso do Brasil.
  const todayBrazil = todayBrazilDateString()

  const activePromos = await prisma.task.findMany({
    where: { promocaoAtiva: true, promocaoAte: { not: null } },
    select: { id: true, promocaoAte: true },
  })
  const expiredIds = activePromos
    .filter((t) => t.promocaoAte && toDateOnlyString(t.promocaoAte) < todayBrazil)
    .map((t) => t.id)

  const result = expiredIds.length
    ? await prisma.task.updateMany({
        where: { id: { in: expiredIds } },
        data: { promocaoAtiva: false },
      })
    : { count: 0 }

  return NextResponse.json({ expired: result.count })
}
