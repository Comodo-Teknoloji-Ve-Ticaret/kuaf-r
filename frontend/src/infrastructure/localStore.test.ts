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
    expect(store.read().version).toBe(1)
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
    expect(db.tenants).toHaveLength(2)
    expect(db.branches.filter((b) => b.tenantId === db.tenants[0].id)).toHaveLength(2)
    expect(db.users.some((u) => u.role === 'platform' && u.tenantId === null)).toBe(true)
    expect(db.appointments.some((a) => a.date === '2026-11-20')).toBe(true)
    expect(db.tickets.some((t) => t.status === 'closed')).toBe(true)
  })
  it('fits comfortably in localStorage', () => {
    expect(JSON.stringify(buildSeed('2026-11-20')).length).toBeLessThan(3_000_000)
  })
})
