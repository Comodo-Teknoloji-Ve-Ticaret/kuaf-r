import { describe, expect, it } from 'vitest'
import { applyDiscount, formatTRY } from './money'

describe('money', () => {
  it('applies percent discounts rounded to kuruş', () => {
    expect(applyDiscount(10000, { type: 'percent', value: 15 })).toBe(8500)
    expect(applyDiscount(999, { type: 'percent', value: 33 })).toBe(669)
  })
  it('applies amount discounts and never goes below zero', () => {
    expect(applyDiscount(10000, { type: 'amount', value: 2500 })).toBe(7500)
    expect(applyDiscount(1000, { type: 'amount', value: 2500 })).toBe(0)
    expect(applyDiscount(1000, null)).toBe(1000)
  })
  it('formats kuruş as Turkish lira', () => {
    expect(formatTRY(1425000).replace(/\s/g, ' ')).toBe('₺14.250')
    expect(formatTRY(1425050).replace(/\s/g, ' ')).toBe('₺14.250,50')
  })
})
