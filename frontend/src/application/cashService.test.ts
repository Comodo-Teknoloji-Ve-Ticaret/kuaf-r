import { describe, expect, it } from 'vitest'
import type { User } from '../domain/types'
import { appointmentService } from './appointmentService'
import { cashService } from './cashService'
import { setup } from './testkit'

const owner: User = { id: 'u1', tenantId: 't1', name: 'Sahip', role: 'owner', branchIds: ['b1'] }
const reception: User = { id: 'u2', tenantId: 't1', name: 'Resepsiyon', role: 'reception', branchIds: ['b1'] }
const clock = () => ({ date: '2026-11-20', min: 700 })

function withProduct() {
  const r = setup()
  r.products.upsert({ id: 'p1', name: 'Şampuan', brand: 'X', category: 'Şampuan', kind: 'retail', price: 50000, cost: 20000, stock: 5, critical: 2 })
  return r
}

describe('cashService', () => {
  it('refuses payments on a locked day', () => {
    const r = setup()
    const c = cashService(r, reception, clock)
    const t = c.openTicket({ branchId: 'b1', customerId: null })
    c.addLine(t.id, { kind: 'service', refId: 'sv1', name: 'Kesim', staffId: 's1', qty: 1, unitPrice: 40000, discount: null })
    c.closeDay('b1', '2026-11-20', 0, '')
    expect(c.pay(t.id, [{ method: 'cash', amount: 40000 }])).toEqual({ ok: false, error: 'day_locked' })
  })
  it('refuses overpayment', () => {
    const r = setup()
    const c = cashService(r, reception, clock)
    const t = c.openTicket({ branchId: 'b1', customerId: null })
    c.addLine(t.id, { kind: 'service', refId: 'sv1', name: 'Kesim', staffId: 's1', qty: 1, unitPrice: 40000, discount: null })
    expect(c.pay(t.id, [{ method: 'cash', amount: 30000 }, { method: 'card', amount: 20000 }])).toEqual({ ok: false, error: 'overpaid' })
  })
  it('requires a customer for debt', () => {
    const r = setup()
    const c = cashService(r, reception, clock)
    const t = c.openTicket({ branchId: 'b1', customerId: null })
    c.addLine(t.id, { kind: 'service', refId: 'sv1', name: 'Kesim', staffId: 's1', qty: 1, unitPrice: 40000, discount: null })
    expect(c.pay(t.id, [{ method: 'debt', amount: 40000 }])).toEqual({ ok: false, error: 'debt_needs_customer' })
  })
  it('closing a full payment decreases stock, completes the appointment and creates sold packages', () => {
    const r = withProduct()
    r.packageDefs.upsert({ id: 'pd1', name: '5 Fön', items: [{ serviceId: 'sv2', count: 5 }], price: 120000, validDays: 90, active: true })
    const a = appointmentService(r, clock).create({ branchId: 'b1', staffId: 's1', customerId: 'm1', date: '2026-11-20', start: 600, serviceIds: ['sv1'] }).appt
    const c = cashService(r, reception, clock)
    const t = appointmentService(r, clock).toTicket(a.id)
    c.addLine(t.id, { kind: 'product', refId: 'p1', name: 'Şampuan', staffId: 's1', qty: 2, unitPrice: 50000, discount: null })
    c.addLine(t.id, { kind: 'package_sale', refId: 'pd1', name: '5 Fön', qty: 1, unitPrice: 120000, discount: null })
    const res = c.pay(t.id, [{ method: 'card', amount: 260000 }])
    expect(res.ok).toBe(true)
    expect(r.tickets.get(t.id)!.status).toBe('closed')
    expect(r.products.get('p1')!.stock).toBe(3)
    expect(r.stockMoves.list({ productId: 'p1', kind: 'sale' })[0].qty).toBe(-2)
    expect(r.appointments.get(a.id)!.status).toBe('completed')
    const cp = r.customerPackages.list({ customerId: 'm1' })[0]
    expect(cp.remaining).toEqual({ sv2: 5 })
    expect(cp.expiresOn).toBe('2027-02-18')
  })
  it('package use decrements remaining sessions and fails when none left', () => {
    const r = setup()
    r.customerPackages.upsert({ id: 'cp1', customerId: 'm1', packageDefId: 'pd1', remaining: { sv2: 1 }, soldOn: '2026-11-01', expiresOn: '2027-01-01' })
    const c = cashService(r, reception, clock)
    const use = { kind: 'package_use' as const, refId: 'cp1', serviceId: 'sv2', name: 'Fön (paket)', staffId: 's1', qty: 1, unitPrice: 0, discount: null }
    const t1 = c.openTicket({ branchId: 'b1', customerId: 'm1' })
    c.addLine(t1.id, use)
    expect(c.pay(t1.id, []).ok).toBe(true)
    expect(r.customerPackages.get('cp1')!.remaining.sv2).toBe(0)
    const t2 = c.openTicket({ branchId: 'b1', customerId: 'm1' })
    c.addLine(t2.id, use)
    expect(c.pay(t2.id, [])).toEqual({ ok: false, error: 'no_sessions' })
    expect(r.tickets.get(t2.id)!.status).toBe('open')
  })
  it('expected cash = cash sales + cash debt collections − cash expenses', () => {
    const r = setup()
    const c = cashService(r, reception, clock)
    const t = c.openTicket({ branchId: 'b1', customerId: 'm1' })
    c.addLine(t.id, { kind: 'service', refId: 'sv1', name: 'Kesim', staffId: 's1', qty: 1, unitPrice: 40000, discount: null })
    c.pay(t.id, [{ method: 'cash', amount: 10000 }, { method: 'card', amount: 10000 }, { method: 'debt', amount: 20000 }])
    expect(c.collectDebt('m1', 5000, 'cash', 'b1').ok).toBe(true)
    c.addExpense({ branchId: 'b1', category: 'Malzeme', amount: 3000, method: 'cash', note: '' })
    c.addExpense({ branchId: 'b1', category: 'Fatura', amount: 9999, method: 'card', note: '' })
    expect(c.expectedCash('b1', '2026-11-20')).toBe(12000)
  })
  it('cannot collect more than the open balance', () => {
    const r = setup()
    expect(cashService(r, reception, clock).collectDebt('m1', 100, 'cash', 'b1')).toEqual({ ok: false, error: 'exceeds_balance' })
  })
  it('only the owner can reopen a closed day', () => {
    const r = setup()
    const dz = cashService(r, reception, clock).closeDay('b1', '2026-11-20', 0, '')
    expect(() => cashService(r, reception, clock).reopenDay(dz.id)).toThrow()
    cashService(r, owner, clock).reopenDay(dz.id)
    expect(cashService(r, owner, clock).isLocked('b1', '2026-11-20')).toBe(false)
  })
})
