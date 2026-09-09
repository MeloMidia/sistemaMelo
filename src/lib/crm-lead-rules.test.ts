import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getDuplicatePhoneKey,
  getLatestMessageAwaitingResponse,
  groupDuplicateLeads,
} from './crm-lead-rules'

const now = new Date('2026-09-09T15:00:00.000Z')

test('identifica inbound antigo como aguardando resposta', () => {
  const result = getLatestMessageAwaitingResponse([
    { direction: 'INBOUND', createdAt: '2026-09-08T14:59:00.000Z' },
  ], now)

  assert.equal(result?.toISOString(), '2026-09-08T14:59:00.000Z')
})

test('ignora conversa recente ou já respondida', () => {
  assert.equal(
    getLatestMessageAwaitingResponse([
      { direction: 'INBOUND', createdAt: '2026-09-09T14:30:00.000Z' },
    ], now),
    null,
  )
  assert.equal(
    getLatestMessageAwaitingResponse([
      { direction: 'OUTBOUND', createdAt: '2026-09-08T10:00:00.000Z' },
    ], now),
    null,
  )
})

test('normaliza telefones brasileiros para encontrar duplicidades', () => {
  assert.equal(getDuplicatePhoneKey('(11) 99999-1111'), '5511999991111')
  assert.equal(getDuplicatePhoneKey('5511999991111'), '5511999991111')
})

test('agrupa somente leads com o mesmo telefone normalizado', () => {
  const groups = groupDuplicateLeads([
    { id: 'a', name: 'Ana', phone: '(11) 99999-1111' },
    { id: 'b', name: 'Ana Silva', phone: '5511999991111' },
    { id: 'c', name: 'Bruno', phone: '5521999992222' },
  ])

  assert.equal(groups.length, 1)
  assert.equal(groups[0].key, '5511999991111')
  assert.deepEqual(groups[0].leads.map((lead) => lead.id), ['a', 'b'])
})

