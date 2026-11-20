import { DB_VERSION, type DB, type Store } from '../application/db'

export function emptyDb(): DB {
  return {
    version: DB_VERSION, tenants: [], branches: [], users: [], staff: [], categories: [], services: [], customers: [],
    appointments: [], blocks: [], tickets: [], debtCollections: [], expenses: [], dayCloses: [], products: [],
    stockMoves: [], packageDefs: [], customerPackages: [], templates: [], messages: [], colorCards: [],
  }
}

export function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}

/** Eski şema sürümlerini günceller; bilinmeyen sürümde null döner. */
function migrate(raw: Record<string, unknown>, today: string): Record<string, unknown> | null {
  let db = raw
  if ((db.version === 1 || db.version === 2) && db.seededFor) return { reseed: true }
  if (db.version === 1) {
    const tenants = (db.tenants as Record<string, unknown>[] | undefined) ?? []
    db = {
      ...db,
      version: 2,
      tenants: tenants.map((t) => ({ businessType: 'kuafor', license: { start: today, days: 30 }, ...t })),
    }
  }
  if (db.version === 2) db = { ...db, version: 3 }
  return db.version === DB_VERSION ? fillDefaults(db) : null
}

/**
 * Güncel sürümde eksik kalmış alanları tamamlar (idempotent).
 * v2 verisi ve yarım kalmış v3 verisi buradan geçer; mevcut değerlere dokunmaz.
 */
function fillDefaults(db: Record<string, unknown>): Record<string, unknown> {
  type R = Record<string, unknown>
  const products = (db.products as R[] | undefined) ?? []
  const uniq = (xs: unknown[]) => [...new Set(xs.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'tr'))
  return {
    ...db,
    colorCards: Array.isArray(db.colorCards) ? db.colorCards : [],
    tenants: ((db.tenants as R[] | undefined) ?? []).map((t) => {
      const mine = products.filter((p) => p.tenantId === t.id)
      return {
        ...t,
        accounts: Array.isArray(t.accounts) ? t.accounts : [{ id: `acc_${t.id}_pos`, name: 'POS cihazı', kind: 'pos', active: true }, { id: `acc_${t.id}_bank`, name: 'Banka hesabı', kind: 'bank', active: true }],
        expenseCategories: Array.isArray(t.expenseCategories) ? t.expenseCategories : [...DEFAULT_EXPENSE_CATS],
        brands: Array.isArray(t.brands) ? t.brands : uniq(mine.map((p) => p.brand)),
        productCategories: Array.isArray(t.productCategories) ? t.productCategories : uniq(mine.map((p) => p.category)),
      }
    }),
    staff: ((db.staff as R[] | undefined) ?? []).map((s) => ({
      ...s,
      commissionMode: s.commissionMode ?? 'category',
      categoryRates: s.categoryRates ?? {},
      serviceRates: s.serviceRates ?? {},
      brandRates: s.brandRates ?? {},
      tiers: Array.isArray(s.tiers) ? s.tiers : [{ from: 0, rate: 0 }, { from: 5_000_000, rate: 30 }],
    })),
    // KDV oranı olmayan ürünlerin fiyatı eski kurala göre KDV dahil kabul edilip hariçe çevrilir
    products: products.map((p) => (typeof p.vatRate === 'number' ? p : { ...p, vatRate: 20, price: Math.round(Number(p.price) / 1.2), cost: Math.round(Number(p.cost) / 1.2) })),
  }
}



export const DEFAULT_EXPENSE_CATS = ['Malzeme', 'Kira', 'Fatura', 'Maaş / Avans', 'Temizlik', 'Mutfak / İkram', 'Kargo', 'Diğer']

function isValid(db: unknown): db is DB {
  if (!db || typeof db !== 'object') return false
  const d = db as Record<string, unknown>
  return d.version === DB_VERSION && Object.keys(emptyDb()).every((k) => k === 'version' || Array.isArray(d[k]))
}

export function createLocalStore(key = 'makas:v1', storage: Storage = localStorage, seedFn: () => DB, today = new Date().toISOString().slice(0, 10)): Store {
  const listeners = new Set<() => void>()
  let recovered = false
  let persistError = false
  let db: DB

  const persist = () => {
    try {
      storage.setItem(key, JSON.stringify(db))
      persistError = false
    } catch {
      persistError = true
    }
  }

  const raw = (() => {
    try { return storage.getItem(key) } catch { return null }
  })()
  if (raw === null) {
    db = seedFn()
    persist()
  } else {
    try {
      const parsed = migrate(JSON.parse(raw), today)
      if (parsed && 'reseed' in parsed) throw new Error('reseed')
      if (!isValid(parsed)) throw new Error('schema')
      db = parsed
      if (JSON.stringify(parsed) !== raw) persist() // taşındı veya onarıldı
    } catch (e) {
      recovered = (e as Error).message !== 'reseed'
      db = seedFn()
      persist()
    }
  }

  return {
    read: () => db,
    write(next) {
      db = next
      persist()
      listeners.forEach((fn) => fn())
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    reset() {
      db = seedFn()
      persist()
      listeners.forEach((fn) => fn())
    },
    get recovered() { return recovered },
    get persistError() { return persistError },
  }
}
