import { describe, expect, it } from 'vitest'
import { commissionFor, tieredCommission, type CommissionCtx } from './commission'
import { mkStaff, mkTicket } from './testkit'

const ctx: CommissionCtx = {
  categoryOf: (sid) => ({ kesim: 'c_kesim', boya: 'c_boya' } as Record<string, string>)[sid],
  brandOf: (pid) => ({ p_ola: 'Olaplex', p_x: 'Loreal' } as Record<string, string>)[pid],
}
const line = (id: string, kind: 'service' | 'product', refId: string, unitPrice: number, staffId = 's1') => ({ id, kind, refId, name: refId, staffId, qty: 1, unitPrice, discount: null })

describe('commissionFor · category mode', () => {
  const staff = mkStaff({ serviceCommission: 40, productCommission: 10, categoryRates: { c_boya: 30 }, serviceRates: { kesim: 50 }, brandRates: { Olaplex: 20 } })
  it('uses service rate, then category rate, then the default', () => {
    const t = mkTicket({ lines: [line('a', 'service', 'kesim', 10000), line('b', 'service', 'boya', 10000), line('c', 'service', 'fon', 10000)] })
    expect(commissionFor(staff, [t], ctx).service).toBe(5000 + 3000 + 4000)
  })
  it('uses the brand rate for products, else the default product rate', () => {
    const t = mkTicket({ lines: [line('a', 'product', 'p_ola', 10000), line('b', 'product', 'p_x', 10000)] })
    expect(commissionFor(staff, [t], ctx).product).toBe(2000 + 1000)
  })
  it('ignores open tickets and other staff, adds own tips', () => {
    const t = mkTicket({ lines: [line('a', 'service', 'fon', 10000), line('b', 'service', 'fon', 10000, 's2')], tip: 500, tipStaffId: 's1' })
    expect(commissionFor(staff, [t, mkTicket({ id: 'k2', status: 'open', lines: [line('x', 'service', 'fon', 99900)] })], ctx)).toEqual({ service: 4000, product: 0, tip: 500, total: 4500, serviceBase: 10000 })
  })
  it('spreads the ticket discount over lines', () => {
    const t = mkTicket({ lines: [line('a', 'service', 'fon', 50000)], discount: { type: 'percent', value: 10 } })
    expect(commissionFor(staff, [t], ctx).service).toBe(18000)
  })
})

describe('tiered commission (marginal, monthly)', () => {
  const tiers = [{ from: 0, rate: 0 }, { from: 2_000_000, rate: 35 }, { from: 5_000_000, rate: 45 }]
  it('pays nothing below the first threshold and only on the part above each step', () => {
    expect(tieredCommission(1_500_000, tiers)).toBe(0)
    expect(tieredCommission(6_000_000, tiers)).toBe(1_050_000 + 450_000)
  })
  it('handles the 0–50k → 0, above → 40% example', () => {
    expect(tieredCommission(8_000_000, [{ from: 0, rate: 0 }, { from: 5_000_000, rate: 40 }])).toBe(1_200_000)
  })
  it('applies tiers per calendar month', () => {
    const staff = mkStaff({ commissionMode: 'tiered', tiers: [{ from: 0, rate: 0 }, { from: 5_000_000, rate: 40 }], productCommission: 0 })
    const a = mkTicket({ id: 'a', date: '2026-10-30', lines: [line('a', 'service', 'fon', 6_000_000)] })
    const b = mkTicket({ id: 'b', date: '2026-11-02', lines: [line('b', 'service', 'fon', 6_000_000)] })
    // Ekim: 1M aşan × %40 = 400k; Kasım: aynı → toplam 800k (birleşik 12M olsaydı 2.8M olurdu)
    expect(commissionFor(staff, [a, b], ctx).service).toBe(800_000)
  })
})
