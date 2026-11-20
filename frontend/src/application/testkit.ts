import { hours9to12 } from '../domain/testkit'
import { createLocalStore, emptyDb, memoryStorage } from '../infrastructure/localStore'
import { createRepos, type Repos } from './repos'

export function setup(): Repos {
  const store = createLocalStore('t', memoryStorage(), emptyDb)
  const r = createRepos(store, 't1')
  r.tenants.upsert({ id: 't1', name: 'Test', slug: 'test', logoColor: '#000', plan: 'pro', status: 'active', createdAt: '2026-01-01', businessType: 'kuafor', license: { start: '2026-11-01', days: 365 }, accounts: [{ id: 'pos1', name: 'Garanti POS', kind: 'pos', active: true }, { id: 'pos2', name: 'Ziraat POS', kind: 'pos', active: true }, { id: 'bank1', name: 'İş Bankası', kind: 'bank', active: true }], expenseCategories: ['Malzeme'], brands: [], productCategories: [], onlineBooking: { enabled: true, requireApproval: true, maxDaysAhead: 30, minLeadMinutes: 60 } })
  r.branches.upsert({ id: 'b1', name: 'Merkez', address: '', phone: '', hours: hours9to12 })
  r.categories.upsert({ id: 'c1', name: 'Kesim', color: 'kesim', order: 0 })
  r.services.upsert({ id: 'sv1', categoryId: 'c1', name: 'Kesim', duration: 30, price: 40000, online: true, overrides: { s2: { price: 50000 } } })
  r.services.upsert({ id: 'sv2', categoryId: 'c1', name: 'Fön', duration: 30, price: 30000, online: true, overrides: {} })
  const base = { branchId: 'b1', title: 'Kuaför', color: '#000', phone: '', hours: hours9to12, serviceIds: ['sv1', 'sv2'], serviceCommission: 40, productCommission: 10, active: true, commissionMode: 'category' as const, categoryRates: {}, serviceRates: {}, brandRates: {}, tiers: [] }
  r.staff.upsert({ ...base, id: 's1', name: 'Ayşe' })
  r.staff.upsert({ ...base, id: 's2', name: 'Mert' })
  r.customers.upsert({ id: 'm1', name: 'Elif Kaya', phone: '5321112233', tags: [], notes: '', consentSms: true, createdAt: '2026-01-01' })
  return r
}
