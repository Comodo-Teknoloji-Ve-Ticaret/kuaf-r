import { netLineAmounts } from './ticket'
import type { CommissionTier, ID, Staff, Ticket } from './types'

export interface Commission {
  service: number
  product: number
  tip: number
  total: number
  serviceBase: number // prim hesabına giren hizmet cirosu (indirim sonrası)
}

export interface CommissionCtx {
  categoryOf: (serviceId: ID) => ID | undefined
  brandOf: (productId: ID) => string | undefined
}

/** Marjinal kademe: her dilimin oranı yalnızca o dilime düşen tutara uygulanır. */
export function tieredCommission(base: number, tiers: CommissionTier[]): number {
  const sorted = [...tiers].sort((a, b) => a.from - b.from)
  let total = 0
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i].from
    const to = sorted[i + 1]?.from ?? Infinity
    if (base <= from) break
    total += ((Math.min(base, to) - from) * sorted[i].rate) / 100
  }
  return Math.round(total)
}

export function commissionFor(staff: Staff, tickets: Ticket[], ctx: CommissionCtx): Commission {
  let service = 0
  let product = 0
  let tip = 0
  let serviceBase = 0
  const monthly = new Map<string, number>()
  for (const t of tickets) {
    if (t.status !== 'closed') continue
    const net = netLineAmounts(t)
    for (const l of t.lines) {
      if (l.staffId !== staff.id) continue
      const amount = net.get(l.id) ?? 0
      if (l.kind === 'service') {
        serviceBase += amount
        if (staff.commissionMode === 'tiered') {
          const m = t.date.slice(0, 7)
          monthly.set(m, (monthly.get(m) ?? 0) + amount)
        } else {
          const cat = ctx.categoryOf(l.refId)
          const rate = staff.serviceRates?.[l.refId] ?? (cat ? staff.categoryRates?.[cat] : undefined) ?? staff.serviceCommission
          service += (amount * rate) / 100
        }
      } else if (l.kind === 'product') {
        const brand = ctx.brandOf(l.refId)
        const rate = (brand ? staff.brandRates?.[brand] : undefined) ?? staff.productCommission
        product += (amount * rate) / 100
      }
    }
    if (t.tipStaffId === staff.id) tip += t.tip
  }
  if (staff.commissionMode === 'tiered') for (const base of monthly.values()) service += tieredCommission(base, staff.tiers ?? [])
  const s = Math.round(service)
  const p = Math.round(product)
  return { service: s, product: p, tip, total: s + p + tip, serviceBase }
}
