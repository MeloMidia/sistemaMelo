import assert from 'node:assert/strict'
import test from 'node:test'
import { isTaskColumnKey, TASK_COLUMNS } from './task-columns'

test('aceita só as três colunas do quadro de Tarefas', () => {
  for (const key of Object.keys(TASK_COLUMNS)) assert.equal(isTaskColumnKey(key), true)
  assert.equal(isTaskColumnKey('col-outra'), false)
  assert.equal(isTaskColumnKey(''), false)
  assert.equal(isTaskColumnKey(undefined), false)
  assert.equal(isTaskColumnKey(42), false)
})

test('não confunde propriedades herdadas com colunas', () => {
  assert.equal(isTaskColumnKey('toString'), false)
  assert.equal(isTaskColumnKey('__proto__'), false)
  assert.equal(isTaskColumnKey('constructor'), false)
})
