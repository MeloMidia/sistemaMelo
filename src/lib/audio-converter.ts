import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ffmpegStatic from 'ffmpeg-static'

export const WHATSAPP_VOICE_MIME_TYPE = 'audio/ogg; codecs=opus'
export const WHATSAPP_VOICE_FILE_NAME = 'audio.ogg'

type PreparedAudio = {
  buffer: Buffer
  mimeType: string
  fileName: string
  converted: boolean
}

function hasOggHeader(buffer: Buffer) {
  return buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'OggS'
}

function inputExtension(mimeType: string | null | undefined) {
  const normalized = (mimeType ?? '').toLocaleLowerCase('pt-BR')
  if (normalized.includes('webm')) return 'webm'
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3'
  if (normalized.includes('mp4') || normalized.includes('aac')) return 'm4a'
  if (normalized.includes('wav')) return 'wav'
  if (normalized.includes('ogg')) return 'ogg'
  return 'audio'
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const ffmpegPath = typeof ffmpegStatic === 'string' && ffmpegStatic ? ffmpegStatic : 'ffmpeg'
    const child = spawn(ffmpegPath, args, { windowsHide: true })
    let stderr = ''

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Falha ao converter audio para WhatsApp${stderr ? `: ${stderr.slice(-500)}` : ''}`))
    })
  })
}

export async function prepareWhatsAppVoiceAudio(input: {
  buffer: Buffer
  mimeType?: string | null
}): Promise<PreparedAudio> {
  if (hasOggHeader(input.buffer)) {
    return {
      buffer: input.buffer,
      mimeType: WHATSAPP_VOICE_MIME_TYPE,
      fileName: WHATSAPP_VOICE_FILE_NAME,
      converted: false,
    }
  }

  const id = randomUUID()
  const inputPath = path.join(tmpdir(), `meloflow-audio-${id}.${inputExtension(input.mimeType)}`)
  const outputPath = path.join(tmpdir(), `meloflow-audio-${id}.ogg`)

  try {
    await fs.writeFile(inputPath, input.buffer)
    await runFfmpeg([
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'libopus',
      '-b:a',
      '32k',
      '-application',
      'voip',
      outputPath,
    ])

    return {
      buffer: await fs.readFile(outputPath),
      mimeType: WHATSAPP_VOICE_MIME_TYPE,
      fileName: WHATSAPP_VOICE_FILE_NAME,
      converted: true,
    }
  } finally {
    await Promise.all([
      fs.unlink(inputPath).catch(() => undefined),
      fs.unlink(outputPath).catch(() => undefined),
    ])
  }
}
