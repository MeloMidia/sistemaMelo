import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando busca por leads que são grupos do WhatsApp...')
  
  const leads = await prisma.lead.findMany()
  // Group JIDs usually contain 18 digits or more, starting with 120 (e.g. 120363409015507152)
  const groupLeads = leads.filter(lead => lead.phone.length >= 15 || lead.phone.startsWith('120'))
  
  console.log(`Encontrados ${groupLeads.length} leads de grupos para deletar:`)
  for (const lead of groupLeads) {
    console.log(`- ID: ${lead.id}, Nome: ${lead.name || 'Sem nome'}, Telefone: ${lead.phone}`)
  }

  if (groupLeads.length > 0) {
    const ids = groupLeads.map(l => l.id)
    const result = await prisma.lead.deleteMany({
      where: {
        id: { in: ids }
      }
    })
    console.log(`Sucesso: ${result.count} leads de grupos foram removidos do banco de dados (com cascade delete de suas mensagens/tags).`)
  } else {
    console.log('Nenhum lead de grupo encontrado no banco de dados.')
  }
}

main()
  .catch(err => {
    console.error('Erro na execução do script:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
