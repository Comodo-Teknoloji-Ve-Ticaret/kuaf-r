import { describe, expect, it } from 'vitest'
import { lineTotal, ticketTotals } from './ticket'
import { mkTicket } from './testkit'

const line = (id: string, unitPrice: number, extra = {}) => ({ id, kind: 'service' as const, refId: 'x', name: 'x', qty: 1, unitPrice, discount: null, ...extra })

describe('ticketTotals', () => {
  it('handles ticket discount with split payment and debt to the kuruş', () => {
    const t = mkTicket({
      lines: [line('l1', 45000), line('l2', 30000)],
      discount: { type: 'percent', value: 10 },
      payments: [{ method: 'cash', amount: 40000 }, { method: 'card', amount: 20000 }, { method: 'debt', amount: 7500 }],
    })
    expect(ticketTotals(t)).toEqual({ subtotal: 75000, discount: 7500, total: 67500, paid: 60000, debt: 7500, remaining: 0 })
  })
  it('adds tip to the total and applies line discounts first', () => {
    const t = mkTicket({ lines: [line('l1', 10000, { qty: 2, discount: { type: 'percent', value: 15 } })], tip: 2000 })
    expect(lineTotal(t.lines[0])).toBe(17000)
    expect(ticketTotals(t)).toMatchObject({ subtotal: 17000, total: 19000, remaining: 19000 })
  })
})
