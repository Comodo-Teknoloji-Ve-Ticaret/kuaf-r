import type { Tenant } from '../domain/types'
import { TEMPLATES } from '../infrastructure/seed'
import { newId, type Store } from './db'

export function slugify(s: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u' }
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => map[c])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const DEFAULT_HOURS = { 0: null, 1: { open: 540, close: 1200 }, 2: { open: 540, close: 1200 }, 3: { open: 540, close: 1200 }, 4: { open: 540, close: 1200 }, 5: { open: 540, close: 1200 }, 6: { open: 540, close: 1200 } }
const STARTER_CATS = [
  { name: 'Kesim', color: 'kesim' }, { name: 'Boya & Renk', color: 'boya' }, { name: 'Bakım', color: 'bakim' }, { name: 'Fön & Şekillendirme', color: 'fon' },
] as const

export interface NewSalon { name: string; slug: string; ownerName: string; branchName: string; plan: Tenant['plan'] }

/** Comodo platform yönetimi: salon (kiracı) oluşturma ve askıya alma. */
export function platformService(store: Store) {
  const slugTaken = (slug: string, exceptId?: string) => store.read().tenants.some((t) => t.slug === slug && t.id !== exceptId)

  function createSalon(input: NewSalon): { ok: true; tenant: Tenant } | { ok: false; error: 'slug_taken' | 'invalid' } {
    const slug = slugify(input.slug || input.name)
    if (!slug || !input.name.trim() || !input.ownerName.trim()) return { ok: false, error: 'invalid' }
    if (slugTaken(slug)) return { ok: false, error: 'slug_taken' }
    const db = store.read()
    const tid = newId('t_')
    const bid = newId('b_')
    const tenant: Tenant = {
      id: tid, name: input.name.trim(), slug, logoColor: '#6c5ce7', plan: input.plan, status: 'active', createdAt: new Date().toISOString().slice(0, 10),
      onlineBooking: { enabled: true, requireApproval: true, maxDaysAhead: 30, minLeadMinutes: 120 },
    }
    store.write({
      ...db,
      tenants: [...db.tenants, tenant],
      branches: [...db.branches, { id: bid, tenantId: tid, name: input.branchName.trim() || 'Merkez', address: '', phone: '', hours: DEFAULT_HOURS }],
      users: [...db.users,
        { id: newId('u_'), tenantId: tid, name: input.ownerName.trim(), role: 'owner', branchIds: [bid] },
        { id: newId('u_'), tenantId: tid, name: 'Resepsiyon', role: 'reception', branchIds: [bid] }],
      categories: [...db.categories, ...STARTER_CATS.map((c, i) => ({ id: newId('c_'), tenantId: tid, name: c.name, color: c.color, order: i }))],
      templates: [...db.templates, ...TEMPLATES.map((t) => ({ ...t, id: newId('tp_'), tenantId: tid }))],
    })
    return { ok: true, tenant }
  }

  function setStatus(tenantId: string, status: Tenant['status']) {
    const db = store.read()
    store.write({ ...db, tenants: db.tenants.map((t) => (t.id === tenantId ? { ...t, status } : t)) })
  }

  return { createSalon, setStatus, slugTaken }
}
