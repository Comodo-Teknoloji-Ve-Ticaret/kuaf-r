import type { ID } from '../domain/types'
import { newId, type CollectionKey, type DB, type Store } from './db'

type Row<K extends CollectionKey> = DB[K][number]

export interface Collection<T extends { id: ID }> {
  list(filter?: Partial<T>): T[]
  get(id: ID): T | undefined
  upsert(item: Omit<T, 'id' | 'tenantId'> & { id?: ID; tenantId?: ID | null }): T
  remove(id: ID): void
}

export type Repos = { [K in CollectionKey]: Collection<Row<K>> } & { tenantId: ID | null; store: Store }

const PREFIX: Record<CollectionKey, string> = {
  tenants: 't_', branches: 'b_', users: 'u_', staff: 's_', categories: 'c_', services: 'sv_', customers: 'm_',
  appointments: 'a_', blocks: 'bl_', tickets: 'k_', debtCollections: 'dc_', expenses: 'e_', dayCloses: 'dz_',
  products: 'p_', stockMoves: 'sm_', packageDefs: 'pd_', customerPackages: 'cp_', templates: 'tp_', messages: 'ml_',
}

function matches<T>(row: T, filter?: Partial<T>): boolean {
  if (!filter) return true
  for (const k in filter) if ((row as Record<string, unknown>)[k] !== filter[k]) return false
  return true
}

/**
 * Kiracıya göre kapsamlanmış repository'ler.
 * tenantId === null: platform yöneticisi; tüm kiracıları okur.
 * `tenants` koleksiyonunda kapsam kaydın kendi id'sidir.
 */
export function createRepos(store: Store, tenantId: ID | null): Repos {
  const scopeOf = (key: CollectionKey, row: Record<string, unknown>) => (key === 'tenants' ? row.id : row.tenantId)
  const visible = (key: CollectionKey, row: Record<string, unknown>) => tenantId === null || scopeOf(key, row) === tenantId

  function collection<K extends CollectionKey>(key: K): Collection<Row<K>> {
    type T = Row<K>
    const rows = () => store.read()[key] as T[]
    return {
      list: (filter) => rows().filter((r) => visible(key, r as never) && matches(r, filter)),
      get: (id) => rows().find((r) => r.id === id && visible(key, r as never)),
      upsert(item) {
        const db = store.read()
        const all = db[key] as T[]
        const id = item.id ?? newId(PREFIX[key])
        const idx = all.findIndex((r) => r.id === id)
        if (idx >= 0 && !visible(key, all[idx] as never)) throw new Error('Bu kayda erişim yetkiniz yok')
        const base: Record<string, unknown> = { ...(idx >= 0 ? all[idx] : {}), ...item, id }
        if (key !== 'tenants' && tenantId !== null) base.tenantId = tenantId
        if (key === 'tenants' && tenantId !== null && id !== tenantId) throw new Error('Bu kayda erişim yetkiniz yok')
        const row = base as unknown as T
        const next = idx >= 0 ? all.map((r, i) => (i === idx ? row : r)) : [...all, row]
        store.write({ ...db, [key]: next })
        return row
      },
      remove(id) {
        const db = store.read()
        const all = db[key] as T[]
        const target = all.find((r) => r.id === id)
        if (!target || !visible(key, target as never)) return
        store.write({ ...db, [key]: all.filter((r) => r.id !== id) })
      },
    }
  }

  const keys = Object.keys(PREFIX) as CollectionKey[]
  const repos = Object.fromEntries(keys.map((k) => [k, collection(k)])) as unknown as Repos
  repos.tenantId = tenantId
  repos.store = store
  return repos
}
