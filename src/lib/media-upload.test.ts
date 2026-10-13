import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMegabytes, isMediaUploadPathname, mediaUploadPathname } from './media-upload'

test('gera caminho seguro no Blob a partir do nome do arquivo', () => {
  assert.equal(mediaUploadPathname('Vídeo da reunião (1).mp4'), 'crm-media/Video-da-reuniao-1-.mp4')
  assert.equal(mediaUploadPathname('../../etc/passwd'), 'crm-media/etc-passwd')
  assert.equal(mediaUploadPathname('漢字.mp4'), 'crm-media/mp4')
  assert.equal(mediaUploadPathname(''), 'crm-media/arquivo')
  assert.ok(mediaUploadPathname(`${'a'.repeat(300)}.mp4`).endsWith('.mp4'))
  for (const name of ['Vídeo.mp4', '../x', '', '漢字.mp4', `${'b'.repeat(900)}.mov`]) {
    assert.equal(isMediaUploadPathname(mediaUploadPathname(name)), true, name)
  }
})

test('aceita só caminhos dentro da pasta de mídia do CRM', () => {
  assert.equal(isMediaUploadPathname('crm-media/video-x1y2.mp4'), true)
  assert.equal(isMediaUploadPathname('crm-media/'), false)
  assert.equal(isMediaUploadPathname('outra-pasta/video.mp4'), false)
  assert.equal(isMediaUploadPathname('crm-media/../segredo.txt'), false)
  assert.equal(isMediaUploadPathname('https://abc.private.blob.vercel-storage.com/crm-media/video.mp4'), false)
  assert.equal(isMediaUploadPathname(`crm-media/${'a'.repeat(600)}.mp4`), false)
})

test('formata tamanho em MB no padrão brasileiro', () => {
  assert.equal(formatMegabytes(4 * 1024 * 1024), '4,0 MB')
  assert.equal(formatMegabytes(12.34 * 1024 * 1024), '12,3 MB')
})
