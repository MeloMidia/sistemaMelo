import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
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

async function resolveFfmpegPath() {
  const configuredPath = process.env.FFMPEG_BIN ?? process.env.FFMPEG_PATH
  const candidates = [configuredPath, ffmpegStatic].filter(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0,
  )

  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // Try the next configured binary, then the system PATH.
    }
  }

  return 'ffmpeg'
}

async function runFfmpeg(input: Buffer, args: string[]) {
  const ffmpegPath = await resolveFfmpegPath()

  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const outputChunks: Buffer[] = []
    let stderr = ''
    let settled = false

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }

    child.stdout.on('data', (chunk: Buffer) => outputChunks.push(chunk))

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
      if (stderr.length > 2000) stderr = stderr.slice(-2000)
    })

    child.once('error', (error) => {
      fail(
        new Error(
          `FFmpeg nao esta disponivel no servidor. Configure FFMPEG_BIN ou instale o binario no ambiente de producao. ${error.message}`,
        ),
      )
    })

    child.once('close', (code) => {
      if (settled) return
      if (code === 0) {
        settled = true
        resolve(Buffer.concat(outputChunks))
        return
      }

      fail(new Error(`Falha ao converter audio para WhatsApp${stderr ? `: ${stderr.slice(-500)}` : ''}`))
    })

    child.stdin.once('error', (error) => {
      fail(new Error(`Falha ao enviar audio para o FFmpeg: ${error.message}`))
    })
    child.stdin.end(input)
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

  const output = await runFfmpeg(input.buffer, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-i',
    'pipe:0',
    '-vn',
    '-ac',
    '1',
    '-ar',
    '48000',
    '-c:a',
    'libopus',
    '-b:a',
    '24k',
    '-application',
    'voip',
    '-f',
    'ogg',
    'pipe:1',
  ])

  return {
    buffer: output,
    mimeType: WHATSAPP_VOICE_MIME_TYPE,
    fileName: WHATSAPP_VOICE_FILE_NAME,
    converted: true,
  }
}
