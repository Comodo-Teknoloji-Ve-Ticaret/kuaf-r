import type { ID, Product, StockMove } from '../domain/types'
import { istanbulClock, type Clock } from './appointmentService'
import type { Repos } from './repos'

export function stockService(repos: Repos, clock: Clock = istanbulClock) {
  const get = (id: ID) => {
    const p = repos.products.get(id)
    if (!p) throw new Error('Ürün bulunamadı')
    return p
  }
  function apply(id: ID, qty: number, kind: StockMove['kind'], note: string): Product {
    const p = get(id)
    repos.stockMoves.upsert({ productId: id, date: clock().date, qty, kind, note })
    return repos.products.upsert({ ...p, stock: p.stock + qty })
  }
  const positive = (n: number) => {
    if (!Number.isFinite(n) || n <= 0) throw new Error('Miktar sıfırdan büyük olmalı')
  }
  return {
    receive: (id: ID, qty: number, note: string) => (positive(qty), apply(id, qty, 'in', note)),
    use: (id: ID, qty: number, note: string) => (positive(qty), apply(id, -qty, 'use', note)),
    count: (id: ID, counted: number, note = 'Sayım') => {
      if (!Number.isFinite(counted) || counted < 0) throw new Error('Geçersiz sayım')
      const diff = counted - get(id).stock
      return diff === 0 ? get(id) : apply(id, diff, 'adjust', note)
    },
    critical: () => repos.products.list().filter((p) => p.stock <= p.critical),
  }
}
