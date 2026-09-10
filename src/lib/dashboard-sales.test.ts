import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getClosedLeadSaleValue,
  summarizeClosedLeadSales,
} from './dashboard-sales'

test('conta somente leads fechados com valor positivo como venda', () => {
  const summary = summarizeClosedLeadSales([
    { closedAt: new Date('2026-09-09T12:00:00.000Z'), value: 9000 },
    { closedAt: new Date('2026-09-09T13:00:00.000Z'), value: 3500 },
    { closedAt: new Date('2026-09-09T14:00:00.000Z'), value: null },
    { closedAt: new Date('2026-09-09T15:00:00.000Z'), value: 0 },
  ])

  assert.equal(summary.salesCount, 2)
  assert.equal(summary.revenue, 12500)
  assert.equal(summary.salesWithoutValue, 2)
})

test('ignora valores invalidos ou zerados para venda confirmada', () => {
  assert.equal(getClosedLeadSaleValue(null), null)
  assert.equal(getClosedLeadSaleValue(0), null)
  assert.equal(getClosedLeadSaleValue(Number.NaN), null)
  assert.equal(getClosedLeadSaleValue(1), 1)
})
