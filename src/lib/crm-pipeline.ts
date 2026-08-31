import { prisma } from '@/lib/prisma'

/** Etapas iniciais criadas somente quando a base comercial está vazia. */
export const DEFAULT_CRM_PIPELINE = [
  { name: 'Novos leads', order: 1000, color: '#2f855a' },
  { name: 'Em atendimento', order: 2000, color: '#3b6fd8' },
  { name: 'Qualificados', order: 3000, color: '#8b5cf6' },
  { name: 'Agendados', order: 4000, color: '#d6922e' },
  { name: 'Proposta enviada', order: 5000, color: '#c45b3c' },
  { name: 'Fechados', order: 6000, color: '#15724f' },
] as const

/**
 * Mantém o CRM utilizável depois de uma limpeza de base: há sempre uma etapa
 * de entrada e leads legados sem etapa voltam a aparecer no quadro.
 */
export async function ensureCrmPipeline() {
  let entryStage = await prisma.leadStage.findFirst({ orderBy: { order: 'asc' } })

  if (!entryStage) {
    await prisma.$transaction(async (tx) => {
      if (await tx.leadStage.count() === 0) {
        await tx.leadStage.createMany({ data: [...DEFAULT_CRM_PIPELINE] })
      }
    })
    entryStage = await prisma.leadStage.findFirst({ orderBy: { order: 'asc' } })
  }

  if (!entryStage) throw new Error('Não foi possível preparar o pipeline do CRM.')

  await prisma.lead.updateMany({
    where: { stageId: null },
    data: { stageId: entryStage.id },
  })

  return entryStage
}
