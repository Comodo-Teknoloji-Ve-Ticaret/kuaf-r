import { netLineAmounts } from './ticket'
import type { Staff, Ticket } from './types'

export interface Commission {
  service: number
  product: number
  tip: number
  total: number
}

export function commissionFor(staff: Staff, tickets: Ticket[]): Commission {
  let service = 0
  let product = 0
  let tip = 0
  for (const t of tickets) {
    if (t.status !== 'closed') continue
    const net = netLineAmounts(t)
    for (const l of t.lines) {
      if (l.staffId !== staff.id) continue
      const amount = net.get(l.id) ?? 0
      if (l.kind === 'service') service += amount
      else if (l.kind === 'product') product += amount
    }
    if (t.tipStaffId === staff.id) tip += t.tip
  }
  const s = Math.round((service * staff.serviceCommission) / 100)
  const p = Math.round((product * staff.productCommission) / 100)
  return { service: s, product: p, tip, total: s + p + tip }
}
