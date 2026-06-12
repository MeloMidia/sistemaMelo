import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, createdAt: true }
  })
  console.log('Usuarios encontrados no Neon:', users.length)
  users.forEach(u => console.log(' -', u.email, '| nome:', u.name))
  await prisma.$disconnect()
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1) })
