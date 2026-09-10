export type ClosedLeadSaleInput = {
  closedAt: Date | null
  value: number | null
}

export function getClosedLeadSaleValue(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

export function summarizeClosedLeadSales(closedLeads: readonly ClosedLeadSaleInput[]) {
  let revenue = 0
  let salesCount = 0
  let salesWithoutValue = 0

  for (const sale of closedLeads) {
    const saleValue = getClosedLeadSaleValue(sale.value)
    if (saleValue === null) {
      salesWithoutValue += 1
      continue
    }

    revenue += saleValue
    salesCount += 1
  }

  return { revenue, salesCount, salesWithoutValue }
}
