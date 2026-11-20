import type { Discount } from './types'

const fmt0 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
const fmt2 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 })

/** Kuruşu ₺ olarak biçimler; küsurat yoksa kuruşsuz gösterir. */
export function formatTRY(kurus: number): string {
  return kurus % 100 === 0 ? fmt0.format(kurus / 100) : fmt2.format(kurus / 100)
}

export function applyDiscount(amount: number, d: Discount | null): number {
  if (!d || !d.value) return amount
  const off = d.type === 'percent' ? Math.round((amount * Math.min(100, d.value)) / 100) : d.value
  return Math.max(0, amount - off)
}

/** ₺ girişini (ör. "1.250,50") kuruşa çevirir. */
export function parseTRY(input: string): number {
  const clean = input.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(clean)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** KDV hariç tutara KDV ekler. */
export const withVat = (net: number, rate: number) => Math.round(net * (1 + rate / 100))

/** KDV dahil tutarı hariç + KDV olarak ayırır. */
export function vatSplit(gross: number, rate: number) {
  const net = Math.round(gross / (1 + rate / 100))
  return { net, vat: gross - net }
}
