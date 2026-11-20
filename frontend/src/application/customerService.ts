import { normalizePhone } from '../domain/phone'
import { ticketTotals } from '../domain/ticket'
import type { Customer, ID } from '../domain/types'
import type { Repos } from './repos'

export type SaveCustomer = Omit<Customer, 'id' | 'tenantId' | 'createdAt'> & { id?: ID; createdAt?: string }
export type SaveResult = { ok: true; customer: Customer } | { ok: false; error: 'duplicate_phone' | 'invalid_phone' | 'name_required'; existingId?: ID }

export const trLower = (s: string) => s.toLocaleLowerCase('tr-TR')

export interface CustomerStats {
  visits: number
  noShows: number
  totalSpent: number
  lastVisit: string | null
  balance: number
}

export function customerService(repos: Repos) {
  function save(input: SaveCustomer): SaveResult {
    if (!input.name.trim()) return { ok: false, error: 'name_required' }
    const phone = normalizePhone(input.phone)
    if (!phone) return { ok: false, error: 'invalid_phone' }
    const dup = repos.customers.list({ phone }).find((c) => c.id !== input.id)
    if (dup) return { ok: false, error: 'duplicate_phone', existingId: dup.id }
    const customer = repos.customers.upsert({ ...input, name: input.name.trim(), phone, createdAt: input.createdAt ?? new Date().toISOString().slice(0, 10) })
    return { ok: true, customer }
  }

  function search(q: string): Customer[] {
    const term = trLower(q.trim())
    if (!term) return []
    let digits = q.replace(/\D/g, '')
    if (digits.startsWith('90') && digits.length > 10) digits = digits.slice(2)
    if (digits.startsWith('0')) digits = digits.slice(1)
    return repos.customers.list().filter((c) => trLower(c.name).includes(term) || (digits.length >= 3 && c.phone.includes(digits)))
  }

  function balance(id: ID): number {
    const debt = repos.tickets.list({ customerId: id }).filter((t) => t.status === 'closed').reduce((s, t) => s + ticketTotals(t).debt, 0)
    const paid = repos.debtCollections.list({ customerId: id }).reduce((s, d) => s + d.amount, 0)
    return debt - paid
  }

  function stats(id: ID): CustomerStats {
    const appts = repos.appointments.list({ customerId: id })
    const done = appts.filter((a) => a.status === 'completed').sort((a, b) => b.date.localeCompare(a.date))
    const totalSpent = repos.tickets.list({ customerId: id }).filter((t) => t.status === 'closed').reduce((s, t) => s + ticketTotals(t).total, 0)
    return { visits: done.length, noShows: appts.filter((a) => a.status === 'no_show').length, totalSpent, lastVisit: done[0]?.date ?? null, balance: balance(id) }
  }

  return { save, search, stats, balance }
}
