import { DB_VERSION } from '../application/db'
import { describe, expect, it } from 'vitest'
import { createRepos } from '../application/repos'
import { createLocalStore, emptyDb, memoryStorage } from './localStore'
import { buildSeed } from './seed'

const fresh = () => createLocalStore('test', memoryStorage(), () => emptyDb())

describe('tenant isolation', () => {
  it('never returns another tenant’s record', () => {
    const store = fresh()
    const a = createRepos(store, 'tA')
    const b = createRepos(store, 'tB')
    const c = a.customers.upsert({ name: 'Elif', phone: '5321112233', tags: [], notes: '', consentSms: true, createdAt: 'x' })
    expect(c.tenantId).toBe('tA')
    expect(a.customers.get(c.id)?.name).toBe('Elif')
    expect(b.customers.get(c.id)).toBeUndefined()
    expect(b.customers.list()).toEqual([])
  })
  it('cannot overwrite another tenant’s record by id', () => {
    const store = fresh()
    const a = createRepos(store, 'tA')
    const b = createRepos(store, 'tB')
    const c = a.customers.upsert({ name: 'Elif', phone: '5321112233', tags: [], notes: '', consentSms: true, createdAt: 'x' })
    expect(() => b.customers.upsert({ ...c, name: 'Hack' })).toThrow()
    b.customers.remove(c.id)
    expect(a.customers.get(c.id)?.name).toBe('Elif')
  })
  it('updates an existing record in place', () => {
    const a = createRepos(fresh(), 'tA')
    const c = a.customers.upsert({ name: 'Elif', phone: '5321112233', tags: [], notes: '', consentSms: true, createdAt: 'x' })
    a.customers.upsert({ ...c, notes: 'Boya 7.1' })
    expect(a.customers.list()).toHaveLength(1)
    expect(a.customers.get(c.id)?.notes).toBe('Boya 7.1')
  })
})

describe('localStore persistence', () => {
  it('falls back to seed and flags recovery on corrupted storage', () => {
    const storage = memoryStorage()
    storage.setItem('k', '{oops')
    const store = createLocalStore('k', storage, () => ({ ...emptyDb(), tenants: [] }))
    expect(store.recovered).toBe(true)
    expect(store.read().version).toBe(DB_VERSION)
  })
  it('falls back to seed on schema version mismatch', () => {
    const storage = memoryStorage()
    storage.setItem('k', JSON.stringify({ version: 0 }))
    expect(createLocalStore('k', storage, emptyDb).recovered).toBe(true)
  })
  it('reloads what was written', () => {
    const storage = memoryStorage()
    const s1 = createLocalStore('k', storage, emptyDb)
    createRepos(s1, 'tA').customers.upsert({ name: 'Elif', phone: '5321112233', tags: [], notes: '', consentSms: true, createdAt: 'x' })
    const s2 = createLocalStore('k', storage, emptyDb)
    expect(s2.recovered).toBe(false)
    expect(createRepos(s2, 'tA').customers.list()).toHaveLength(1)
  })
  it('keeps working in memory when storage is full', () => {
    const storage = memoryStorage()
    storage.setItem = () => { throw new Error('QuotaExceededError') }
    const store = createLocalStore('k', storage, emptyDb)
    createRepos(store, 'tA').customers.upsert({ name: 'Elif', phone: '5321112233', tags: [], notes: '', consentSms: true, createdAt: 'x' })
    expect(store.persistError).toBe(true)
    expect(createRepos(store, 'tA').customers.list()).toHaveLength(1)
  })
})

describe('buildSeed', () => {
  it('is deterministic', () => {
    expect(JSON.stringify(buildSeed('2026-11-20'))).toBe(JSON.stringify(buildSeed('2026-11-20')))
  })
  it('creates two salons, one with two branches, and a platform user', () => {
    const db = buildSeed('2026-11-20')
    expect(db.tenants).toHaveLength(4)
    expect(db.tenants.map((t) => t.businessType)).toEqual(['kuafor', 'berber', 'guzellik', 'dis'])
    expect(db.branches.filter((b) => b.tenantId === db.tenants[0].id)).toHaveLength(2)
    expect(db.users.some((u) => u.role === 'platform' && u.tenantId === null)).toBe(true)
    expect(db.appointments.some((a) => a.date === '2026-11-20')).toBe(true)
    expect(db.tickets.some((t) => t.status === 'closed')).toBe(true)
  })
  it('keeps product stock equal to its movements and never negative', () => {
    const db = buildSeed('2026-11-20')
    for (const p of db.products) {
      expect(p.stock).toBeGreaterThanOrEqual(0)
      expect(db.stockMoves.filter((m) => m.productId === p.id).reduce((s, m) => s + m.qty, 0)).toBe(p.stock)
    }
  })
  it('fits comfortably in localStorage', () => {
    expect(JSON.stringify(buildSeed('2026-11-20')).length).toBeLessThan(3_000_000)
  })
})

describe('schema migration', () => {
  it('upgrades v1 data instead of wiping it', () => {
    const storage = memoryStorage()
    const v1 = { ...emptyDb(), version: 1, tenants: [{ id: 't1', name: 'Eski', slug: 'eski', logoColor: '#000', plan: 'pro', status: 'active', createdAt: '2026-11-01', onlineBooking: { enabled: true, requireApproval: true, maxDaysAhead: 30, minLeadMinutes: 60 } }] }
    storage.setItem('k', JSON.stringify(v1))
    const store = createLocalStore('k', storage, emptyDb, '2026-11-20')
    expect(store.recovered).toBe(false)
    expect(store.read().version).toBe(DB_VERSION)
    // Lisans taşıma gününden başlar; eski işletme anında kilitlenmez
    expect(store.read().tenants[0]).toMatchObject({ name: 'Eski', businessType: 'kuafor', license: { start: '2026-11-20', days: 30 } })
  })
  it('replaces untouched v1 demo data with a fresh seed instead of migrating it', () => {
    const storage = memoryStorage()
    storage.setItem('k', JSON.stringify({ ...emptyDb(), version: 1, seededFor: '2026-11-19' }))
    const store = createLocalStore('k', storage, () => ({ ...emptyDb(), seededFor: 'fresh' }), '2026-11-20')
    expect(store.read().seededFor).toBe('fresh')
  })
})

describe('schema migration v2 → v3', () => {
  it('adds accounts/brands/commission/vat defaults and keeps shelf prices the same', () => {
    const storage = memoryStorage()
    const v2 = {
      ...emptyDb(), version: 2,
      tenants: [{ id: 't1', name: 'Eski', slug: 'eski', logoColor: '#000', plan: 'pro', status: 'active', createdAt: '2026-11-01', businessType: 'kuafor', license: { start: '2026-11-01', days: 30 }, onlineBooking: { enabled: true, requireApproval: true, maxDaysAhead: 30, minLeadMinutes: 60 } }],
      staff: [{ id: 's1', tenantId: 't1', branchId: 'b1', name: 'A', title: '', color: '#000', phone: '', hours: {}, serviceIds: [], serviceCommission: 40, productCommission: 10, active: true }],
      products: [{ id: 'p1', tenantId: 't1', name: 'Şampuan', brand: 'Loreal', category: 'Şampuan', kind: 'retail', price: 120000, cost: 60000, stock: 1, critical: 1 }],
    }
    storage.setItem('k', JSON.stringify(v2))
    const db = createLocalStore('k', storage, emptyDb, '2026-11-21').read()
    expect(db.version).toBe(3)
    expect(db.tenants[0].accounts.map((a) => a.kind)).toEqual(['pos', 'bank'])
    expect(db.tenants[0].brands).toEqual(['Loreal'])
    expect(db.tenants[0].productCategories).toEqual(['Şampuan'])
    expect(db.tenants[0].expenseCategories.length).toBeGreaterThan(3)
    expect(db.staff[0]).toMatchObject({ commissionMode: 'category', categoryRates: {}, serviceRates: {}, brandRates: {} })
    expect(db.products[0]).toMatchObject({ vatRate: 20, price: 100000, cost: 50000 })
    expect(db.colorCards).toEqual([])
  })
})
