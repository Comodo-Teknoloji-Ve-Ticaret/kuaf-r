import { describe, expect, it } from 'vitest'
import { commissionFor } from './commission'
import { mkStaff, mkTicket } from './testkit'

describe('commissionFor', () => {
  const staff = mkStaff({ serviceCommission: 40, productCommission: 10 })
  const lines = [
    { id: 'l1', kind: 'service' as const, refId: 'x', name: 'Kesim', staffId: 's1', qty: 1, unitPrice: 50000, discount: null },
    { id: 'l2', kind: 'product' as const, refId: 'p', name: 'Şampuan', staffId: 's1', qty: 1, unitPrice: 20000, discount: null },
    { id: 'l3', kind: 'service' as const, refId: 'x', name: 'Fön', staffId: 's2', qty: 1, unitPrice: 30000, discount: null },
  ]
  it('pays service and product rates on closed tickets only, plus tips', () => {
    const r = commissionFor(staff, [mkTicket({ lines, tip: 1000, tipStaffId: 's1' }), mkTicket({ id: 'k2', status: 'open', lines })])
    expect(r).toEqual({ service: 20000, product: 2000, tip: 1000, total: 23000 })
  })
  it('spreads the ticket discount over lines before computing', () => {
    const r = commissionFor(staff, [mkTicket({ lines: [lines[0]], discount: { type: 'percent', value: 10 } })])
    expect(r.service).toBe(18000)
  })
})
