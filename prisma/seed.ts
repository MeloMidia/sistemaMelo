import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('senha123', 10)

  // Array of 4 initial users
  const users = [
    { name: 'Usuário 1', email: 'user1@example.com', passwordHash },
    { name: 'Usuário 2', email: 'user2@example.com', passwordHash },
    { name: 'Usuário 3', email: 'user3@example.com', passwordHash },
    { name: 'Usuário 4', email: 'user4@example.com', passwordHash },
  ]

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    })
  }

  // Create initial columns if none exist
  const columnCount = await prisma.column.count()
  if (columnCount === 0) {
    const defaultColumns = [
      { title: 'To Do', order: 1000 },
      { title: 'In Progress', order: 2000 },
      { title: 'Done', order: 3000 },
    ]

    for (const col of defaultColumns) {
      await prisma.column.create({
        data: col
      })
    }
  }

  // Create initial CRM lead stages if none exist
  const stageCount = await prisma.leadStage.count()
  if (stageCount === 0) {
    const defaultStages = [
      { name: 'Novo Contato', order: 1000, color: '#3b82f6' },
      { name: 'Em Conversa', order: 2000, color: '#f59e0b' },
      { name: 'Qualificado', order: 3000, color: '#10b981' },
      { name: 'Cliente', order: 4000, color: '#8b5cf6' },
    ]

    for (const stage of defaultStages) {
      await prisma.leadStage.create({ data: stage })
    }
  }

  // Create initial CRM tags if none exist
  const crmTagCount = await prisma.crmTag.count()
  if (crmTagCount === 0) {
    const defaultTags = [
      { name: 'Quente', color: '#ef4444' },
      { name: 'Frio', color: '#3b82f6' },
      { name: 'Indicação', color: '#10b981' },
    ]

    for (const tag of defaultTags) {
      await prisma.crmTag.create({ data: tag })
    }
  }

  console.log('Seed executed successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
