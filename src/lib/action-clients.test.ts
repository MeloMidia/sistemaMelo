import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildActionClientActionTitleDescription,
  getActionClientStageStart,
  parseActionClientTaskDescription,
} from './action-clients'

const payload = {
  actionTitle: 'Ação',
  clientId: 'client-1',
  clientTitle: 'Cliente',
  createdAt: '2026-09-20T10:00:00.000Z',
  dueAt: '2026-09-24T10:00:00.000Z',
  decidedAt: '2026-09-25T10:00:00.000Z',
  analysisAt: '2026-09-26T10:00:00.000Z',
  practiceAt: '2026-09-27T10:00:00.000Z',
  executionAt: '2026-09-28T10:00:00.000Z',
}

test('usa o timestamp específico de cada etapa', () => {
  assert.equal(getActionClientStageStart('decision', payload, 'fallback'), payload.decidedAt)
  assert.equal(getActionClientStageStart('analysis', payload, 'fallback'), payload.analysisAt)
  assert.equal(getActionClientStageStart('practice', payload, 'fallback'), payload.practiceAt)
  assert.equal(getActionClientStageStart('execution', payload, 'fallback'), payload.executionAt)
})

test('mantém contador para payloads antigos sem timestamp da etapa', () => {
  const legacyPayload = { ...payload, analysisAt: undefined, practiceAt: undefined, executionAt: undefined }

  assert.equal(getActionClientStageStart('analysis', legacyPayload, 'fallback'), payload.decidedAt)
  assert.equal(getActionClientStageStart('practice', legacyPayload, 'fallback'), payload.decidedAt)
  assert.equal(getActionClientStageStart('execution', legacyPayload, 'fallback'), payload.decidedAt)
  assert.equal(getActionClientStageStart('execution', null, 'fallback'), 'fallback')
})

test('salva a nova ação vinculada ao cliente', () => {
  const description = buildActionClientActionTitleDescription(
    `ACTION_CLIENT_TASK_V1:${JSON.stringify(payload)}`,
    '  Criar rotina de acompanhamento  '
  )

  assert.equal(parseActionClientTaskDescription(description)?.actionTitle, 'Criar rotina de acompanhamento')
})
