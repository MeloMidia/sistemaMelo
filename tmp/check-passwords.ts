import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Testar senha 'senha123' para user1@example.com
  const user = await prisma.user.findUnique({ where: { email: 'user1@example.com' } })
  if (!user) { console.log('Usuario nao encontrado'); return }

  console.log('Hash no banco:', user.passwordHash)

  const ok123 = await bcrypt.compare('senha123', user.passwordHash)
  console.log('Senha "senha123" bate?', ok123)

  // Testar tambem o usuario real
  const higor = await prisma.user.findUnique({ where: { email: 'higormadara1@gmail.com' } })
  if (higor) {
    console.log('\nUsuario Higor hash:', higor.passwordHash)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1) })
