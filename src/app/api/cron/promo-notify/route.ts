import { NextResponse } from 'next/server'
import { isCronRequestAuthorized } from '@/lib/cron-auth'
import { checkPromoExpirations } from '@/lib/promo-notify'

export const runtime = 'nodejs'

// Cron diário do aviso de PromoADS vencendo. Rota própria (fora do cron de
// campanhas) pra poder ser disparada sozinha, sem enviar campanha pra leads,
// e pra deixar o resultado no log/resposta — no Hobby os logs só ficam 1h.
export async function GET(request: Request) {
  if (!(await isCronRequestAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await checkPromoExpirations()
    console.log('[promo-notify]', JSON.stringify(result))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[promo-notify] erro:', error)
    // 500 pra falha aparecer como erro na lista de execuções do cron.
    return NextResponse.json({ ok: false, error }, { status: 500 })
  }
}
