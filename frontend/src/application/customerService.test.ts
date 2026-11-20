import { describe, expect, it } from 'vitest'
import { appointmentService } from './appointmentService'
import { customerService } from './customerService'
import { setup } from './testkit'

describe('customerService.save', () => {
  it('rejects a second customer with the same phone in another spelling', () => {
    const r = setup() // m1: 5321112233
    const res = customerService(r).save({ name: 'Başka', phone: '+90 532 111 22 33', tags: [], notes: '', consentSms: true })
    expect(res).toEqual({ ok: false, error: 'duplicate_phone', existingId: 'm1' })
  })
  it('rejects invalid phones', () => {
    expect(customerService(setup()).save({ name: 'X', phone: '123', tags: [], notes: '', consentSms: true })).toEqual({ ok: false, error: 'invalid_phone' })
  })
  it('stores the normalized phone and allows editing the same customer', () => {
    const r = setup()
    const s = customerService(r)
    const res = s.save({ name: 'Yeni', phone: '0533 222 33 44', tags: [], notes: '', consentSms: true })
    expect(res.ok && res.customer.phone).toBe('5332223344')
    const again = s.save({ ...r.customers.get('m1')!, notes: 'formül' })
    expect(again.ok).toBe(true)
  })
})

describe('customerService.search', () => {
  it('finds by name case-insensitively in Turkish and by phone fragment in any spelling', () => {
    const s = customerService(setup())
    expect(s.search('elif').map((c) => c.id)).toEqual(['m1'])
    expect(s.search('İLİF').length).toBe(0)
    expect(s.search('ELİF').map((c) => c.id)).toEqual(['m1'])
    expect(s.search('0532 111').map((c) => c.id)).toEqual(['m1'])
  })
})

describe('customerService.stats', () => {
  it('counts visits, no-shows, spend and open debt', () => {
    const r = setup()
    const a = appointmentService(r, () => ({ date: '2026-11-20', min: 600 }))
    const x = a.create({ branchId: 'b1', staffId: 's1', customerId: 'm1', date: '2026-11-10', start: 600, serviceIds: ['sv1'] }).appt
    a.setStatus(x.id, 'completed')
    const y = a.create({ branchId: 'b1', staffId: 's1', customerId: 'm1', date: '2026-11-12', start: 600, serviceIds: ['sv1'] }).appt
    a.setStatus(y.id, 'no_show')
    r.tickets.upsert({ branchId: 'b1', date: '2026-11-10', customerId: 'm1', lines: [{ id: 'l', kind: 'service', refId: 'sv1', name: 'Kesim', qty: 1, unitPrice: 40000, discount: null }], discount: null, tip: 0, payments: [{ method: 'cash', amount: 10000 }, { method: 'debt', amount: 30000 }], status: 'closed', createdAt: '' })
    r.debtCollections.upsert({ branchId: 'b1', customerId: 'm1', date: '2026-11-15', amount: 5000, method: 'cash' })
    expect(customerService(r).stats('m1')).toEqual({ visits: 1, noShows: 1, totalSpent: 40000, lastVisit: '2026-11-10', balance: 25000 })
  })
})
