import { describe, expect, it } from 'vitest'
import { reportService, toCSV } from './reportService'
import { setup } from './testkit'

function withTickets() {
  const r = setup()
  const line = (unitPrice: number, staffId = 's1', refId = 'sv1') => ({ id: Math.random().toString(36), kind: 'service' as const, refId, name: 'x', staffId, qty: 1, unitPrice, discount: null })
  r.tickets.upsert({ branchId: 'b1', date: '2026-11-18', customerId: 'm1', lines: [line(40000)], discount: null, tip: 0, payments: [{ method: 'cash', amount: 40000 }], status: 'closed', createdAt: '' })
  r.tickets.upsert({ branchId: 'b1', date: '2026-11-20', customerId: null, lines: [line(30000, 's2', 'sv2')], discount: null, tip: 0, payments: [{ method: 'card', amount: 30000 }], status: 'closed', createdAt: '' })
  r.tickets.upsert({ branchId: 'b1', date: '2026-11-20', customerId: null, lines: [line(99900)], discount: null, tip: 0, payments: [], status: 'open', createdAt: '' })
  r.expenses.upsert({ branchId: 'b1', date: '2026-11-19', category: 'Kira', amount: 10000, method: 'transfer', note: '' })
  return r
}

describe('reportService', () => {
  const range = { from: '2026-11-18', to: '2026-11-20' }
  it('daily revenue counts closed tickets only and fills empty days', () => {
    expect(reportService(withTickets()).revenue(range)).toEqual([
      { date: '2026-11-18', total: 40000, count: 1 },
      { date: '2026-11-19', total: 0, count: 0 },
      { date: '2026-11-20', total: 30000, count: 1 },
    ])
  })
  it('splits by payment method and nets out expenses', () => {
    const s = reportService(withTickets())
    expect(s.byPayment(range)).toEqual({ cash: 40000, card: 30000, transfer: 0, debt: 0 })
    expect(s.expensesNet(range)).toEqual({ revenue: 70000, expenses: 10000, net: 60000 })
  })
  it('ranks services and staff by revenue', () => {
    const s = reportService(withTickets())
    expect(s.byService(range).map((x) => [x.name, x.amount, x.count])).toEqual([['Kesim', 40000, 1], ['Fön', 30000, 1]])
    expect(s.byStaff(range).map((x) => [x.staff.id, x.revenue])).toEqual([['s1', 40000], ['s2', 30000]])
  })
})

describe('toCSV', () => {
  it('uses semicolons, quotes cells with separators and keeps Turkish characters', () => {
    expect(toCSV([['Hizmet', 'Tutar'], ['Fön; Maşa', 350], ['Çağrı "VIP"', 1]])).toBe('﻿Hizmet;Tutar\n"Fön; Maşa";350\n"Çağrı ""VIP""";1')
  })
})
