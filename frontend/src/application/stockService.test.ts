import { describe, expect, it } from 'vitest'
import { stockService } from './stockService'
import { setup } from './testkit'

function withProduct() {
  const r = setup()
  r.products.upsert({ id: 'p1', name: 'Boya 7.1', brand: 'X', category: 'Boya', kind: 'professional', price: 0, cost: 26000, vatRate: 20, stock: 10, critical: 3 })
  return r
}
const clock = () => ({ date: '2026-11-20', min: 600 })

describe('stockService', () => {
  it('stock in adds, use subtracts, both logged', () => {
    const r = withProduct()
    const s = stockService(r, clock)
    s.receive('p1', 6, 'Tedarikçi')
    s.use('p1', 2, 'Salon kullanımı')
    expect(r.products.get('p1')!.stock).toBe(14)
    expect(r.stockMoves.list({ productId: 'p1' }).map((m) => m.qty)).toEqual([6, -2])
  })
  it('count sets the stock to the counted value and logs the difference', () => {
    const r = withProduct()
    stockService(r, clock).count('p1', 7)
    expect(r.products.get('p1')!.stock).toBe(7)
    expect(r.stockMoves.list({ productId: 'p1', kind: 'adjust' })[0].qty).toBe(-3)
  })
  it('rejects non-positive quantities', () => {
    const r = withProduct()
    expect(() => stockService(r, clock).use('p1', 0, '')).toThrow()
    expect(() => stockService(r, clock).receive('p1', -1, '')).toThrow()
  })
  it('lists products at or below critical level', () => {
    const r = withProduct()
    stockService(r, clock).use('p1', 7, '')
    expect(stockService(r, clock).critical().map((p) => p.id)).toEqual(['p1'])
  })
})
