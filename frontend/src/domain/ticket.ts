import { applyDiscount } from './money'
import type { Ticket, TicketLine } from './types'

export const lineTotal = (l: TicketLine) => applyDiscount(l.qty * l.unitPrice, l.discount)

export interface TicketTotals {
  subtotal: number
  discount: number
  total: number
  paid: number
  debt: number
  remaining: number
}

export function ticketTotals(t: Ticket): TicketTotals {
  const subtotal = t.lines.reduce((s, l) => s + lineTotal(l), 0)
  const afterDiscount = applyDiscount(subtotal, t.discount)
  const total = afterDiscount + (t.tip || 0)
  const paid = t.payments.filter((p) => p.method !== 'debt').reduce((s, p) => s + p.amount, 0)
  const debt = t.payments.filter((p) => p.method === 'debt').reduce((s, p) => s + p.amount, 0)
  return { subtotal, discount: subtotal - afterDiscount, total, paid, debt, remaining: total - paid - debt }
}

/** Adisyon indirimini satırlara oransal dağıtılmış net satır tutarları. */
export function netLineAmounts(t: Ticket): Map<string, number> {
  const subtotal = t.lines.reduce((s, l) => s + lineTotal(l), 0)
  const ratio = subtotal ? applyDiscount(subtotal, t.discount) / subtotal : 0
  return new Map(t.lines.map((l) => [l.id, Math.round(lineTotal(l) * ratio)]))
}
