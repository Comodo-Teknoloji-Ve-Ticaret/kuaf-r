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

import { vatSplit, withVat } from './money'
describe('VAT', () => {
  it('adds VAT to a net price, rounded to kuruş', () => {
    expect(withVat(100000, 20)).toBe(120000)
    expect(withVat(99999, 10)).toBe(109999)
  })
  it('splits a gross amount back into net + VAT', () => {
    expect(vatSplit(120000, 20)).toEqual({ net: 100000, vat: 20000 })
  })
})
