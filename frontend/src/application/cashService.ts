import { addDays } from '../domain/time'
import { ticketTotals } from '../domain/ticket'
import type { DayClose, Discount, Expense, ID, Payment, PaymentMethod, Ticket, TicketLine, User } from '../domain/types'
import { istanbulClock, type Clock } from './appointmentService'
import { customerService } from './customerService'
import { newId } from './db'
import type { Repos } from './repos'

export type CashError = 'day_locked' | 'overpaid' | 'debt_needs_customer' | 'no_sessions' | 'needs_customer' | 'unpaid' | 'exceeds_balance' | 'closed'
export type CashResult<T = Ticket> = { ok: true; ticket: T } | { ok: false; error: CashError }

export const CASH_ERROR_TEXT: Record<CashError, string> = {
  day_locked: 'Bu günün kasası kapatılmış. Salon sahibi açmadan işlem yapılamaz.',
  overpaid: 'Ödeme tutarı adisyon toplamını aşıyor.',
  debt_needs_customer: 'Veresiye için adisyona müşteri seçin.',
  no_sessions: 'Pakette bu hizmet için kalan seans yok.',
  needs_customer: 'Paket satışı için adisyona müşteri seçin.',
  unpaid: 'Adisyonda ödenmemiş tutar var.',
  exceeds_balance: 'Tahsilat, müşterinin açık borcundan fazla olamaz.',
  closed: 'Adisyon zaten kapalı.',
}

export interface PayerEntry { key: string; customerId: ID | null; name: string; amount: number; count: number; collection: boolean; at: string }
export interface PayerGroup { people: number; total: number; entries: PayerEntry[] }
const newGroup = (): PayerGroup => ({ people: 0, total: 0, entries: [] })

export const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Nakit', card: 'Kart', transfer: 'Havale/EFT', debt: 'Veresiye' }

export function cashService(repos: Repos, user: User | null, clock: Clock = istanbulClock) {
  const get = (id: ID) => {
    const t = repos.tickets.get(id)
    if (!t) throw new Error('Adisyon bulunamadı')
    return t
  }
  const isLocked = (branchId: ID, date: string) => repos.dayCloses.list({ branchId, date }).some((d) => d.locked)
  const save = (t: Ticket) => repos.tickets.upsert(t)

  function openTicket(input: { branchId: ID; customerId: ID | null }): Ticket {
    return save({
      id: newId('k_'), tenantId: '', branchId: input.branchId, date: clock().date, customerId: input.customerId, lines: [], discount: null,
      tip: 0, payments: [], status: 'open', createdAt: new Date().toISOString(),
    })
  }

  const edit = (id: ID, fn: (t: Ticket) => Ticket) => {
    const t = get(id)
    if (t.status === 'closed') throw new Error('Adisyon kapalı')
    return save(fn(t))
  }

  const addLine = (id: ID, line: Omit<TicketLine, 'id'>) => edit(id, (t) => ({ ...t, lines: [...t.lines, { ...line, id: newId('l_') }] }))
  const updateLine = (id: ID, lineId: ID, patch: Partial<TicketLine>) => edit(id, (t) => ({ ...t, lines: t.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }))
  const removeLine = (id: ID, lineId: ID) => edit(id, (t) => ({ ...t, lines: t.lines.filter((l) => l.id !== lineId) }))
  const setDiscount = (id: ID, discount: Discount | null) => edit(id, (t) => ({ ...t, discount }))
  const setTip = (id: ID, tip: number, tipStaffId?: ID) => edit(id, (t) => ({ ...t, tip, tipStaffId }))
  const setCustomer = (id: ID, customerId: ID | null) => edit(id, (t) => ({ ...t, customerId }))

  function closeProblem(t: Ticket): CashError | null {
    if (t.status === 'closed') return 'closed'
    if (isLocked(t.branchId, t.date)) return 'day_locked'
    const needs = new Map<string, number>()
    for (const l of t.lines) {
      if (l.kind === 'package_sale' && !t.customerId) return 'needs_customer'
      if (l.kind === 'package_use') {
        const cp = repos.customerPackages.get(l.refId)
        const key = `${l.refId}:${l.serviceId}`
        needs.set(key, (needs.get(key) ?? 0) + l.qty)
        if (!cp || (cp.remaining[l.serviceId ?? ''] ?? 0) < (needs.get(key) ?? 0)) return 'no_sessions'
      }
    }
    return null
  }

  function close(t: Ticket): CashResult {
    const problem = closeProblem(t)
    if (problem) return { ok: false, error: problem }
    if (ticketTotals(t).remaining !== 0) return { ok: false, error: 'unpaid' }
    for (const l of t.lines) {
      if (l.kind === 'product') {
        const p = repos.products.get(l.refId)
        if (p) {
          repos.products.upsert({ ...p, stock: p.stock - l.qty })
          repos.stockMoves.upsert({ productId: p.id, date: t.date, qty: -l.qty, kind: 'sale', ticketId: t.id, note: '' })
        }
      } else if (l.kind === 'package_sale') {
        const def = repos.packageDefs.get(l.refId)
        if (def) {
          for (let i = 0; i < l.qty; i++) {
            repos.customerPackages.upsert({
              customerId: t.customerId!, packageDefId: def.id, remaining: Object.fromEntries(def.items.map((it) => [it.serviceId, it.count])),
              soldOn: t.date, expiresOn: addDays(t.date, def.validDays), ticketId: t.id,
            })
          }
        }
      } else if (l.kind === 'package_use') {
        const cp = repos.customerPackages.get(l.refId)!
        const sid = l.serviceId!
        repos.customerPackages.upsert({ ...cp, remaining: { ...cp.remaining, [sid]: cp.remaining[sid] - l.qty } })
      }
    }
    if (t.appointmentId) {
      const a = repos.appointments.get(t.appointmentId)
      if (a && a.status !== 'completed') repos.appointments.upsert({ ...a, status: 'completed' })
    }
    return { ok: true, ticket: save({ ...t, status: 'closed', closedAt: new Date().toISOString() }) }
  }

  /** Ödemeleri kaydeder; kalan sıfırsa adisyonu kapatır. */
  function pay(id: ID, payments: Payment[]): CashResult {
    const t = get(id)
    if (t.status === 'closed') return { ok: false, error: 'closed' }
    if (isLocked(t.branchId, t.date)) return { ok: false, error: 'day_locked' }
    const clean = payments.filter((p) => p.amount > 0)
    if (clean.some((p) => p.method === 'debt') && !t.customerId) return { ok: false, error: 'debt_needs_customer' }
    const next = { ...t, payments: clean }
    const tt = ticketTotals(next)
    if (tt.remaining < 0) return { ok: false, error: 'overpaid' }
    if (tt.remaining > 0) return { ok: true, ticket: save(next) }
    const problem = closeProblem(next)
    if (problem) return { ok: false, error: problem }
    return close(next)
  }

  function cancelTicket(id: ID) {
    const t = get(id)
    if (t.status === 'closed') throw new Error('Kapalı adisyon silinemez')
    repos.tickets.remove(id)
  }

  function collectDebt(customerId: ID, amount: number, method: Exclude<PaymentMethod, 'debt'>, branchId: ID): CashResult<null> {
    const date = clock().date
    if (isLocked(branchId, date)) return { ok: false, error: 'day_locked' }
    if (amount <= 0 || amount > customerService(repos).balance(customerId)) return { ok: false, error: 'exceeds_balance' }
    repos.debtCollections.upsert({ branchId, customerId, date, amount, method })
    return { ok: true, ticket: null }
  }

  function addExpense(input: Omit<Expense, 'id' | 'tenantId' | 'date'> & { date?: string }): CashResult<null> {
    const date = input.date ?? clock().date
    if (isLocked(input.branchId, date)) return { ok: false, error: 'day_locked' }
    repos.expenses.upsert({ ...input, date })
    return { ok: true, ticket: null }
  }

  function dayCash(branchId: ID, date: string) {
    const tickets = repos.tickets.list({ branchId, date, status: 'closed' })
    const by: Record<PaymentMethod, number> = { cash: 0, card: 0, transfer: 0, debt: 0 }
    for (const t of tickets) for (const p of t.payments) by[p.method] += p.amount
    const collections = repos.debtCollections.list({ branchId, date })
    const collected: Record<'cash' | 'card' | 'transfer', number> = { cash: 0, card: 0, transfer: 0 }
    for (const c of collections) collected[c.method] += c.amount
    const expenses = repos.expenses.list({ branchId, date })
    const expenseCash = expenses.filter((e) => e.method === 'cash').reduce((s, e) => s + e.amount, 0)
    const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)
    const revenue = tickets.reduce((s, t) => s + ticketTotals(t).total, 0)
    return { tickets, by, collected, expenses, expenseCash, expenseTotal, revenue, expectedCash: by.cash + collected.cash - expenseCash }
  }

  const expectedCash = (branchId: ID, date: string) => dayCash(branchId, date).expectedCash

  /** Günün ödeme yapanları: yönteme göre kişi sayısı, toplam ve isim listesi (aynı kişi tek satır). */
  function payers(branchId: ID, date: string): Record<'cash' | 'card' | 'transfer', PayerGroup> {
    const groups = { cash: newGroup(), card: newGroup(), transfer: newGroup() }
    const nameOf = (id: ID | null) => (id ? repos.customers.get(id)?.name : undefined) ?? 'Müşterisiz adisyon'
    const add = (method: 'cash' | 'card' | 'transfer', customerId: ID | null, amount: number, key: string, collection: boolean, at: string) => {
      const g = groups[method]
      const k = collection ? `col:${customerId}` : customerId ? `c:${customerId}` : `t:${key}`
      const e = g.entries.find((x) => x.key === k)
      if (e) { e.amount += amount; e.count++; if (at > e.at) e.at = at }
      else g.entries.push({ key: k, customerId, name: nameOf(customerId), amount, count: 1, collection, at })
      g.total += amount
    }
    for (const t of repos.tickets.list({ branchId, date, status: 'closed' })) {
      for (const p of t.payments) if (p.method !== 'debt') add(p.method, t.customerId, p.amount, t.id, false, t.closedAt ?? t.createdAt)
    }
    for (const d of repos.debtCollections.list({ branchId, date })) add(d.method, d.customerId, d.amount, d.id, true, '')
    for (const g of Object.values(groups)) {
      g.entries.sort((a, b) => b.amount - a.amount)
      g.people = new Set(g.entries.map((e) => (e.customerId ? `c:${e.customerId}` : e.key))).size
    }
    return groups
  }

  function closeDay(branchId: ID, date: string, countedCash: number, note: string): DayClose {
    const existing = repos.dayCloses.list({ branchId, date })[0]
    return repos.dayCloses.upsert({ ...existing, branchId, date, expectedCash: expectedCash(branchId, date), countedCash, note, closedBy: user?.id ?? '', locked: true })
  }

  function reopenDay(id: ID): DayClose {
    if (user?.role !== 'owner') throw new Error('Kasayı yalnızca salon sahibi açabilir')
    const d = repos.dayCloses.get(id)
    if (!d) throw new Error('Kayıt yok')
    return repos.dayCloses.upsert({ ...d, locked: false })
  }

  return {
    openTicket, addLine, updateLine, removeLine, setDiscount, setTip, setCustomer, pay, cancelTicket,
    collectDebt, addExpense, dayCash, expectedCash, payers, closeDay, reopenDay, isLocked,
  }
}
