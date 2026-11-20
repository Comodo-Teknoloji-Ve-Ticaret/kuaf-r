import { describe, expect, it } from 'vitest'
import { isSuspendedLogin } from '../app/session'
import { platformService, slugify } from './platformService'
import { setup } from './testkit'

describe('platformService', () => {
  it('creates a salon with a branch, an owner user and starter data', () => {
    const r = setup()
    const res = platformService(r.store).createSalon({ name: 'Saç Atölyesi', slug: 'sac-atolyesi', ownerName: 'Ayla Er', branchName: 'Merkez', plan: 'pro' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const db = r.store.read()
    expect(db.branches.filter((b) => b.tenantId === res.tenant.id)).toHaveLength(1)
    expect(db.users.find((u) => u.tenantId === res.tenant.id && u.role === 'owner')?.name).toBe('Ayla Er')
    expect(db.categories.filter((c) => c.tenantId === res.tenant.id).length).toBeGreaterThan(0)
    expect(db.templates.filter((t) => t.tenantId === res.tenant.id).length).toBe(5)
  })
  it('rejects a slug that is already used', () => {
    const r = setup() // slug 'test'
    expect(platformService(r.store).createSalon({ name: 'X', slug: 'Test', ownerName: 'A', branchName: 'M', plan: 'pro' })).toEqual({ ok: false, error: 'slug_taken' })
  })
  it('suspending a salon blocks its users from logging in', () => {
    const r = setup()
    r.users.upsert({ id: 'u1', tenantId: 't1', name: 'Sahip', role: 'owner', branchIds: ['b1'] })
    platformService(r.store).setStatus('t1', 'suspended')
    expect(isSuspendedLogin(r.store.read(), 'u1')).toBe(true)
  })
  it('slugifies Turkish names', () => {
    expect(slugify('Çağla Güzellik & Saç Şişli')).toBe('cagla-guzellik-sac-sisli')
  })
})
