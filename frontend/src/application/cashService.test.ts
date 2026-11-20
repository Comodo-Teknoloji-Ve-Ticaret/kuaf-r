import { commissionCtx } from './commissionCtx'
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
  r.products.upsert({ id: 'p1', name: 'Şampuan', brand: 'X', category: 'Şampuan', kind: 'retail', price: 50000, cost: 20000, vatRate: 0, stock: 5, critical: 2 })
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

describe('cashService.payers', () => {
  it('groups the day’s payers by method with distinct people, names and amounts', () => {
    const r = setup()
    r.customers.upsert({ id: 'm2', name: 'Can Yıldız', phone: '5332223344', tags: [], notes: '', consentSms: true, createdAt: '' })
    const c = cashService(r, reception, clock)
    const sale = (customerId: string | null, payments: { method: 'cash' | 'card' | 'transfer' | 'debt'; amount: number }[]) => {
      const t = c.openTicket({ branchId: 'b1', customerId })
      c.addLine(t.id, { kind: 'service', refId: 'sv1', name: 'Kesim', staffId: 's1', qty: 1, unitPrice: payments.reduce((s, p) => s + p.amount, 0), discount: null })
      expect(c.pay(t.id, payments).ok).toBe(true)
    }
    sale('m1', [{ method: 'card', amount: 40000 }])
    sale('m1', [{ method: 'card', amount: 10000 }]) // aynı kişi tekrar kartla
    sale('m2', [{ method: 'cash', amount: 20000 }, { method: 'card', amount: 5000 }]) // parçalı
    sale(null, [{ method: 'cash', amount: 30000 }])
    sale(null, [{ method: 'transfer', amount: 15000 }])
    sale('m2', [{ method: 'debt', amount: 7000 }])
    c.collectDebt('m2', 7000, 'transfer', 'b1')

    const p = c.payers('b1', '2026-11-20')
    expect(p.card).toMatchObject({ people: 2, total: 55000 })
    expect(p.card.entries.map((e) => [e.name, e.amount])).toEqual([['Elif Kaya', 50000], ['Can Yıldız', 5000]])
    expect(p.cash).toMatchObject({ people: 2, total: 50000 })
    expect(p.cash.entries.map((e) => e.name)).toEqual(['Müşterisiz adisyon', 'Can Yıldız'])
    expect(p.transfer).toMatchObject({ people: 2, total: 22000 })
    expect(p.transfer.entries.find((e) => e.name === 'Can Yıldız')).toMatchObject({ amount: 7000, collection: true })
  })
})

describe('packages: bonus and automatic use', () => {
  const svcLine = (serviceId: string) => ({ kind: 'service' as const, refId: serviceId, name: 'Fön', staffId: 's1', qty: 1, unitPrice: 30000, discount: null })
  function withPackage(remaining: number, expiresOn = '2027-01-01') {
    const r = setup()
    r.customerPackages.upsert({ id: 'cp1', customerId: 'm1', packageDefId: 'pd1', remaining: { sv2: remaining }, soldOn: '2026-11-01', expiresOn })
    return r
  }
  it('8+2 package gives 10 uses', () => {
    const r = setup()
    r.packageDefs.upsert({ id: 'pd1', name: '8+2 Fön', items: [{ serviceId: 'sv2', count: 8, bonus: 2 }], price: 240000, validDays: 120, active: true })
    const c = cashService(r, reception, clock)
    const t = c.openTicket({ branchId: 'b1', customerId: 'm1' })
    c.addLine(t.id, { kind: 'package_sale', refId: 'pd1', name: '8+2 Fön', qty: 1, unitPrice: 240000, discount: null })
    c.pay(t.id, [{ method: 'card', amount: 240000, accountId: 'pos1' }])
    expect(r.customerPackages.list({ customerId: 'm1' })[0].remaining).toEqual({ sv2: 10 })
  })
  it('a service the customer has in a package is added as a free package use', () => {
    const r = withPackage(1)
    const c = cashService(r, reception, clock)
    const t = c.openTicket({ branchId: 'b1', customerId: 'm1' })
    const after = c.addLine(t.id, svcLine('sv2'))
    expect(after.lines[0]).toMatchObject({ kind: 'package_use', refId: 'cp1', serviceId: 'sv2', unitPrice: 0 })
    const again = c.addLine(t.id, svcLine('sv2'))
    expect(again.lines[1]).toMatchObject({ kind: 'service', unitPrice: 30000 }) // paket bitti, ücretli
  })
  it('expired packages are not used', () => {
    const r = withPackage(3, '2026-11-10')
    const c = cashService(r, reception, clock)
    const t = c.openTicket({ branchId: 'b1', customerId: 'm1' })
    expect(c.addLine(t.id, svcLine('sv2')).lines[0].kind).toBe('service')
  })
  it('picking the customer later converts matching service lines', () => {
    const r = withPackage(2)
    const c = cashService(r, reception, clock)
    const t = c.openTicket({ branchId: 'b1', customerId: null })
    c.addLine(t.id, svcLine('sv2'))
    expect(c.setCustomer(t.id, 'm1').lines[0].kind).toBe('package_use')
  })
  it('a ticket from an appointment uses the package and needs no payment', () => {
    const r = withPackage(2)
    const a = appointmentService(r, clock).create({ branchId: 'b1', staffId: 's1', customerId: 'm1', date: '2026-11-20', start: 600, serviceIds: ['sv2'] }).appt
    const t = cashService(r, reception, clock).fromAppointment(a.id)
    expect(t.lines[0].kind).toBe('package_use')
    expect(cashService(r, reception, clock).pay(t.id, []).ok).toBe(true)
    expect(r.customerPackages.get('cp1')!.remaining.sv2).toBe(1)
  })
  it('a package use line can be switched back to a paid service', () => {
    const r = withPackage(2)
    const c = cashService(r, reception, clock)
    const t = c.openTicket({ branchId: 'b1', customerId: 'm1' })
    const l = c.addLine(t.id, svcLine('sv2')).lines[0]
    expect(c.chargeInstead(t.id, l.id).lines[0]).toMatchObject({ kind: 'service', refId: 'sv2', unitPrice: 30000 })
  })
})

describe('day summary with expenses and accounts', () => {
  it('nets expenses out of each method and splits card/transfer by POS/account', () => {
    const r = setup()
    const c = cashService(r, reception, clock)
    const sell = (payments: { method: 'cash' | 'card' | 'transfer'; amount: number; accountId?: string }[]) => {
      const t = c.openTicket({ branchId: 'b1', customerId: null })
      c.addLine(t.id, { kind: 'service', refId: 'sv1', name: 'x', staffId: 's1', qty: 1, unitPrice: payments.reduce((s, p) => s + p.amount, 0), discount: null })
      c.pay(t.id, payments)
    }
    sell([{ method: 'card', amount: 50000, accountId: 'pos1' }])
    sell([{ method: 'card', amount: 20000, accountId: 'pos2' }])
    sell([{ method: 'cash', amount: 30000 }])
    sell([{ method: 'transfer', amount: 40000, accountId: 'bank1' }])
    c.addExpense({ branchId: 'b1', category: 'Malzeme', amount: 5000, method: 'cash', note: '' })
    c.addExpense({ branchId: 'b1', category: 'Fatura', amount: 8000, method: 'card', accountId: 'pos1', note: '' })
    c.addExpense({ branchId: 'b1', category: 'Kira', amount: 10000, method: 'transfer', accountId: 'bank1', note: '' })
    const d = c.dayCash('b1', '2026-11-20')
    expect(d.methods).toEqual({
      cash: { gross: 30000, expense: 5000, net: 25000 },
      card: { gross: 70000, expense: 8000, net: 62000 },
      transfer: { gross: 40000, expense: 10000, net: 30000 },
    })
    expect(d.revenue).toBe(140000)
    expect(d.expenseTotal).toBe(23000)
    expect(d.netTotal).toBe(117000)
    expect(d.accounts.map((a) => [a.name, a.gross, a.expense, a.net])).toEqual([
      ['Garanti POS', 50000, 8000, 42000], ['Ziraat POS', 20000, 0, 20000], ['İş Bankası', 40000, 10000, 30000],
    ])
  })
})

describe('package per-use value', () => {
  it('splits the package price over all uses including bonus, weighted by service price', () => {
    const r = setup() // sv1 Kesim 400 TL, sv2 Fön 300 TL
    r.packageDefs.upsert({ id: 'pd1', name: '8+2 Fön', items: [{ serviceId: 'sv2', count: 8, bonus: 2 }], price: 240000, validDays: 120, active: true })
    r.packageDefs.upsert({ id: 'pd2', name: 'Karma', items: [{ serviceId: 'sv1', count: 1 }, { serviceId: 'sv2', count: 2 }], price: 80000, validDays: 120, active: true })
    r.customerPackages.upsert({ id: 'cp1', customerId: 'm1', packageDefId: 'pd1', remaining: { sv2: 10 }, soldOn: '2026-11-01', expiresOn: '2027-01-01' })
    r.customerPackages.upsert({ id: 'cp2', customerId: 'm1', packageDefId: 'pd2', remaining: { sv1: 1, sv2: 2 }, soldOn: '2026-11-01', expiresOn: '2027-01-01' })
    const v = commissionCtx(r).packageUseValue!
    expect(v('cp1', 'sv2')).toBe(24000)
    // liste değeri 400 + 2×300 = 1000 → paket 800: Kesim payı 320, Fön payı 480 / 2 = 240
    expect(v('cp2', 'sv1')).toBe(32000)
    expect(v('cp2', 'sv2')).toBe(24000)
  })
})
