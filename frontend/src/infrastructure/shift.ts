import type { DB } from '../application/db'
import { addDays } from '../domain/time'

const DATE_KEYS = new Set(['date', 'soldOn', 'expiresOn', 'createdAt', 'closedAt', 'at', 'seededFor'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}/

function shiftValue(v: string, days: number): string {
  return DATE_RE.test(v) ? addDays(v.slice(0, 10), days) + v.slice(10) : v
}

/** Demo verisindeki tüm tarihleri `days` gün kaydırır (doğum günleri hariç). */
export function shiftDb(db: DB, days: number): DB {
  if (!days) return db
  const walk = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.map(walk)
    if (o && typeof o === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(o)) out[k] = DATE_KEYS.has(k) && typeof v === 'string' ? shiftValue(v, days) : walk(v)
      return out
    }
    return o
  }
  return walk(db) as DB
}
