import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMegabytes, isBlobStoreUrl } from './media-upload'

test('aceita só links https do próprio Vercel Blob', () => {
  assert.equal(isBlobStoreUrl('https://abc123.public.blob.vercel-storage.com/crm-media/video-x1y2.mp4'), true)
  assert.equal(isBlobStoreUrl('http://abc123.public.blob.vercel-storage.com/crm-media/video.mp4'), false)
  assert.equal(isBlobStoreUrl('https://evil.com/?h=.public.blob.vercel-storage.com'), false)
  assert.equal(isBlobStoreUrl('https://public.blob.vercel-storage.com.evil.com/video.mp4'), false)
  assert.equal(isBlobStoreUrl('https://localhost/video.mp4'), false)
  assert.equal(isBlobStoreUrl('não é url'), false)
})

test('formata tamanho em MB no padrão brasileiro', () => {
  assert.equal(formatMegabytes(4 * 1024 * 1024), '4,0 MB')
  assert.equal(formatMegabytes(12.34 * 1024 * 1024), '12,3 MB')
})
