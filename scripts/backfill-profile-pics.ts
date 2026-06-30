/**
 * Backfill de fotos de perfil do WhatsApp para leads existentes.
 *
 * Roda uma única vez:
 *   npx tsx scripts/backfill-profile-pics.ts
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Carrega .env sem precisar do pacote dotenv
const envPath = resolve(__dirname, '../.env')
try {
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch { /* .env ausente — variáveis devem já estar no ambiente */ }

const BASE_URL = (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '')
const API_KEY = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? ''

async function fetchProfilePic(phone: string): Promise<string | null> {
  if (!BASE_URL || !API_KEY || !INSTANCE) return null
  try {
    const res = await fetch(`${BASE_URL}/chat/fetchProfilePictureUrl/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY },
      body: JSON.stringify({ number: phone }),
    })
    if (!res.ok) return null
    const data = await res.json() as Record<string, unknown>
    return typeof data?.profilePictureUrl === 'string' ? data.profilePictureUrl : null
  } catch {
    return null
  }
}

async function main() {
  const prisma = new PrismaClient()

  const leads = await prisma.lead.findMany({
    where: { profilePicUrl: null },
    select: { id: true, phone: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`\n📷 Backfill de fotos de perfil — ${leads.length} leads sem foto.\n`)

  let saved = 0
  let noPhoto = 0
  let failed = 0

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    const progress = `[${String(i + 1).padStart(String(leads.length).length)}/${leads.length}]`

    try {
      const url = await fetchProfilePic(lead.phone)
      if (url) {
        await prisma.lead.update({ where: { id: lead.id }, data: { profilePicUrl: url } })
        console.log(`${progress} ✅ ${lead.phone}`)
        saved++
      } else {
        console.log(`${progress} ⬛ ${lead.phone} (sem foto pública)`)
        noPhoto++
      }
    } catch (err) {
      console.error(`${progress} ❌ ${lead.phone}: ${err}`)
      failed++
    }

    // Intervalo entre chamadas para evitar rate-limit da Evolution / WhatsApp
    if (i < leads.length - 1) {
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  console.log(`\n📊 Resultado:`)
  console.log(`   ✅ Fotos salvas:      ${saved}`)
  console.log(`   ⬛ Sem foto pública:  ${noPhoto}`)
  console.log(`   ❌ Erros:             ${failed}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
