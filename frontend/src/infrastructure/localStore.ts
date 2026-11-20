import { DB_VERSION, type DB, type Store } from '../application/db'

export function emptyDb(): DB {
  return {
    version: DB_VERSION, tenants: [], branches: [], users: [], staff: [], categories: [], services: [], customers: [],
    appointments: [], blocks: [], tickets: [], debtCollections: [], expenses: [], dayCloses: [], products: [],
    stockMoves: [], packageDefs: [], customerPackages: [], templates: [], messages: [],
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

function isValid(db: unknown): db is DB {
  if (!db || typeof db !== 'object') return false
  const d = db as Record<string, unknown>
  return d.version === DB_VERSION && Object.keys(emptyDb()).every((k) => k === 'version' || Array.isArray(d[k]))
}

export function createLocalStore(key = 'makas:v1', storage: Storage = localStorage, seedFn: () => DB): Store {
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
      const parsed = JSON.parse(raw)
      if (!isValid(parsed)) throw new Error('schema')
      db = parsed
    } catch {
      recovered = true
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
