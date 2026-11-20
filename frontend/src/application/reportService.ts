import { isActive, workingRange } from '../domain/availability'
import { commissionFor } from '../domain/commission'
import { netLineAmounts, ticketTotals } from '../domain/ticket'
import { addDays } from '../domain/time'
import type { ID, PaymentMethod, Staff } from '../domain/types'
import { commissionCtx } from './commissionCtx'
import type { Repos } from './repos'

export interface Range { from: string; to: string }

export function toCSV(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\n')
}

export function daysIn(range: Range): string[] {
  const out: string[] = []
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) out.push(d)
  return out
}

export function reportService(repos: Repos) {
  const inRange = (d: string, r: Range) => d >= r.from && d <= r.to
  const tickets = (r: Range, b?: ID) => repos.tickets.list({ status: 'closed' }).filter((t) => inRange(t.date, r) && (!b || t.branchId === b))
  const appts = (r: Range, b?: ID) => repos.appointments.list().filter((a) => inRange(a.date, r) && (!b || a.branchId === b))

  function revenue(r: Range, b?: ID) {
    const map = new Map(daysIn(r).map((d) => [d, { date: d, total: 0, count: 0 }]))
    for (const t of tickets(r, b)) {
      const row = map.get(t.date)!
      row.total += ticketTotals(t).total
      row.count++
    }
    return [...map.values()]
  }

  function byPayment(r: Range, b?: ID): Record<PaymentMethod, number> {
    const out: Record<PaymentMethod, number> = { cash: 0, card: 0, transfer: 0, debt: 0 }
    for (const t of tickets(r, b)) for (const p of t.payments) out[p.method] += p.amount
    return out
  }

  function byService(r: Range, b?: ID) {
    const map = new Map<string, { id: string; name: string; count: number; amount: number }>()
    for (const t of tickets(r, b)) {
      const net = netLineAmounts(t)
      for (const l of t.lines) {
        if (l.kind !== 'service' && l.kind !== 'product') continue
        const name = l.kind === 'service' ? repos.services.get(l.refId)?.name ?? l.name : l.name
        const row = map.get(l.refId) ?? { id: l.refId, name, count: 0, amount: 0 }
        row.count += l.qty
        row.amount += net.get(l.id) ?? 0
        map.set(l.refId, row)
      }
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount)
  }

  function byStaff(r: Range, b?: ID): { staff: Staff; revenue: number; services: number; commission: number }[] {
    const ts = tickets(r, b)
    const ctx = commissionCtx(repos)
    return repos.staff
      .list()
      .filter((s) => !b || s.branchId === b)
      .map((s) => {
        let revenue = 0
        let services = 0
        for (const t of ts) {
          const net = netLineAmounts(t)
          for (const l of t.lines) if (l.staffId === s.id && (l.kind === 'service' || l.kind === 'product')) { revenue += net.get(l.id) ?? 0; if (l.kind === 'service') services++ }
        }
        return { staff: s, revenue, services, commission: commissionFor(s, ts, ctx).total }
      })
      .sort((a, b2) => b2.revenue - a.revenue)
  }

  function occupancy(r: Range, b?: ID): number {
    const staff = repos.staff.list({ active: true }).filter((s) => !b || s.branchId === b)
    let cap = 0
    for (const d of daysIn(r)) for (const s of staff) {
      const w = workingRange(s, d, repos.branches.get(s.branchId)?.hours)
      if (w) cap += w.end - w.start
    }
    const booked = appts(r, b).filter(isActive).reduce((s, a) => s + a.end - a.start, 0)
    return cap ? Math.min(100, Math.round((booked / cap) * 100)) : 0
  }

  function noShows(r: Range, b?: ID) {
    const list = appts(r, b).filter((a) => a.status !== 'cancelled')
    const n = list.filter((a) => a.status === 'no_show').length
    return { count: n, rate: list.length ? Math.round((n / list.length) * 1000) / 10 : 0 }
  }

  function newVsReturning(r: Range, b?: ID) {
    const firstVisit = new Map<string, string>()
    for (const a of repos.appointments.list({ status: 'completed' })) {
      if (!a.customerId) continue
      const f = firstVisit.get(a.customerId)
      if (!f || a.date < f) firstVisit.set(a.customerId, a.date)
    }
    const seen = new Set(appts(r, b).filter((a) => a.status === 'completed' && a.customerId).map((a) => a.customerId!))
    let fresh = 0
    for (const id of seen) if (inRange(firstVisit.get(id) ?? '', r)) fresh++
    return { new: fresh, returning: seen.size - fresh }
  }

  function expensesNet(r: Range, b?: ID) {
    const revenueTotal = tickets(r, b).reduce((s, t) => s + ticketTotals(t).total, 0)
    const expenses = repos.expenses.list().filter((e) => inRange(e.date, r) && (!b || e.branchId === b)).reduce((s, e) => s + e.amount, 0)
    return { revenue: revenueTotal, expenses, net: revenueTotal - expenses }
  }

  return { revenue, byPayment, byService, byStaff, occupancy, noShows, newVsReturning, expensesNet }
}
