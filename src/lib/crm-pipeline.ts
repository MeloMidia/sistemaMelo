import { prisma } from '@/lib/prisma'

export const CRM_ENTRY_STAGE_NAME = 'Novos leads'
export const CRM_CLOSED_STAGE_NAME = 'Fechados'

/** Etapas iniciais criadas somente quando a base comercial está vazia. */
export const DEFAULT_CRM_PIPELINE = [
  { name: CRM_ENTRY_STAGE_NAME, order: 1000, color: '#2f855a' },
  { name: 'Em atendimento', order: 2000, color: '#3b6fd8' },
  { name: 'Qualificados', order: 3000, color: '#8b5cf6' },
  { name: 'Agendados', order: 4000, color: '#d6922e' },
  { name: 'Proposta enviada', order: 5000, color: '#c45b3c' },
  { name: CRM_CLOSED_STAGE_NAME, order: 6000, color: '#15724f' },
] as const

export function isClosedCrmStage(name: string | null | undefined) {
  return name?.trim().toLocaleLowerCase('pt-BR') === CRM_CLOSED_STAGE_NAME.toLocaleLowerCase('pt-BR')
}

/**
 * Garante que o CRM sempre tem uma etapa de entrada ("Novos leads"), criando
 * o pipeline padrão se a base estiver vazia. NÃO reatribui leads sem etapa —
 * `stageId: null` é um estado válido (contato ainda fora do funil, aguardando
 * ser adicionado manualmente).
 */
export async function ensureCrmPipeline() {
  let entryStage = await prisma.leadStage.findFirst({
    where: { name: CRM_ENTRY_STAGE_NAME },
  })

  if (!entryStage) {
    const firstStage = await prisma.leadStage.findFirst({ orderBy: { order: 'asc' } })

    if (!firstStage) {
      await prisma.$transaction(async (tx) => {
        if (await tx.leadStage.count() === 0) {
          await tx.leadStage.createMany({ data: [...DEFAULT_CRM_PIPELINE] })
        }
      })
    }

    entryStage = await prisma.leadStage.findFirst({
      where: { name: CRM_ENTRY_STAGE_NAME },
    })

    // Bases antigas podem ter etapas personalizadas, mas não a entrada do
    // novo CRM. Cria a coluna de entrada antes da primeira existente.
    if (!entryStage) {
      const currentFirstStage = await prisma.leadStage.findFirst({ orderBy: { order: 'asc' } })
      if (currentFirstStage) {
        entryStage = await prisma.leadStage.create({
          data: {
            name: CRM_ENTRY_STAGE_NAME,
            color: '#2f855a',
            order: currentFirstStage.order - 1000,
          },
        })
      } else {
        await prisma.leadStage.createMany({ data: [...DEFAULT_CRM_PIPELINE] })
        entryStage = await prisma.leadStage.findFirst({
          where: { name: CRM_ENTRY_STAGE_NAME },
        })
      }
    }
  }

  if (!entryStage) throw new Error('Não foi possível preparar o pipeline do CRM.')

  return entryStage
}
