import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildActionClientActionTitleDescription,
  buildActionClientCompletionDescription,
  collectClientActionHistory,
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

test('ciclo concluído guarda o título da ação daquele ciclo', () => {
  const description = buildActionClientCompletionDescription(
    `ACTION_CLIENT_TASK_V1:${JSON.stringify({
      ...payload,
      actionTitle: 'Melhorar anúncios',
      practiceActions: [{ text: 'Trocar fotos', completedAt: '2026-10-01T10:00:00.000Z' }, { text: '' }, { text: '' }],
    })}`,
    '2026-10-02T10:00:00.000Z'
  )

  assert.deepEqual(parseActionClientTaskDescription(description)?.completionHistory, [
    { completedAt: '2026-10-02T10:00:00.000Z', actionTitle: 'Melhorar anúncios', actions: ['Trocar fotos'] },
  ])
})

test('histórico do cliente junta as ações em andamento e os ciclos concluídos de todos os cartões dele', () => {
  const card = (overrides: Record<string, unknown>) => `ACTION_CLIENT_TASK_V1:${JSON.stringify({ ...payload, ...overrides })}`
  const columns = [
    {
      title: 'Validando novas ações',
      tasks: [
        {
          id: 'card-a',
          description: card({
            actionTitle: 'Ação A',
            completionHistory: [
              { completedAt: '2026-09-10T10:00:00.000Z', actions: ['Antiga sem título'] },
              { completedAt: '2026-10-05T10:00:00.000Z', actionTitle: 'Ação A', actions: ['Feita 1', 'Feita 2'] },
            ],
          }),
        },
        { id: 'outro-cliente', description: card({ clientId: 'client-2', actionTitle: 'Não é dele' }) },
        { id: 'tarefa-comum', description: 'texto livre' },
      ],
    },
    {
      title: 'Em prática',
      tasks: [
        {
          id: 'card-b',
          description: card({
            actionTitle: 'Ação B',
            completionHistory: [{ completedAt: '2026-09-20T10:00:00.000Z', actionTitle: 'Ação B', actions: ['Feita 3'] }],
          }),
        },
      ],
    },
  ]

  const history = collectClientActionHistory('client-1', columns)

  assert.deepEqual(history.current, [
    { taskId: 'card-a', actionTitle: 'Ação A', stageTitle: 'Validando novas ações' },
    { taskId: 'card-b', actionTitle: 'Ação B', stageTitle: 'Em prática' },
  ])
  assert.deepEqual(history.completed.map((record) => [record.completedAt.slice(0, 10), record.actionTitle, record.actions]), [
    ['2026-10-05', 'Ação A', ['Feita 1', 'Feita 2']],
    ['2026-09-20', 'Ação B', ['Feita 3']],
    ['2026-09-10', undefined, ['Antiga sem título']],
  ])
})
