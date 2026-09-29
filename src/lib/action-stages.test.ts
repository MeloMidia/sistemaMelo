import assert from 'node:assert/strict'
import test from 'node:test'
import { getActionStage, getActionStageFromTitle } from './action-stages'

test('reconhece os nomes personalizados do board de ações', () => {
  assert.equal(getActionStageFromTitle('Definir novas Ações'), 'decision')
  assert.equal(getActionStageFromTitle('Ações'), 'practice')
})

test('usa a posição da coluna quando o título foi personalizado', () => {
  const columns = [
    { title: 'Entrada' },
    { title: 'Escolha' },
    { title: 'Avaliação' },
    { title: 'Plano' },
    { title: 'Execução' },
  ]

  assert.equal(getActionStage(columns[0], columns), 'validation')
  assert.equal(getActionStage(columns[3], columns), 'practice')
  assert.equal(getActionStage(columns[4], columns), 'execution')
})
