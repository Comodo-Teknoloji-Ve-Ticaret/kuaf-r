import { addDays, diffDays } from './time'
import type { BusinessType, License } from './types'

export const GRACE_DAYS = 3
export const EXPIRING_DAYS = 7

export type LicenseState = 'active' | 'expiring' | 'grace' | 'locked'

export interface LicenseStatus {
  end: string
  used: number
  remaining: number
  state: LicenseState
  graceLeft: number
}

/** Bitiş = başlangıç + gün. remaining 0 → son gün. Bitişten sonra GRACE_DAYS gün ek süre, ardından kilit. */
export function licenseStatus(l: License, today: string): LicenseStatus {
  const end = addDays(l.start, l.days)
  const remaining = diffDays(end, today)
  const used = Math.max(0, Math.min(l.days, diffDays(today, l.start)))
  const graceLeft = GRACE_DAYS + remaining
  const state: LicenseState = remaining > EXPIRING_DAYS ? 'active' : remaining >= 0 ? 'expiring' : graceLeft >= 0 ? 'grace' : 'locked'
  return { end, used, remaining, state, graceLeft: Math.max(0, graceLeft) }
}

export const BUSINESS_TYPES: { value: BusinessType; label: string; color: string }[] = [
  { value: 'kuafor', label: 'Kuaför', color: '#6c5ce7' },
  { value: 'berber', label: 'Berber', color: '#12a37b' },
  { value: 'guzellik', label: 'Güzellik merkezi', color: '#e84393' },
  { value: 'dis', label: 'Diş kliniği', color: '#0984e3' },
  { value: 'spa', label: 'Spa & masaj', color: '#00b894' },
  { value: 'tirnak', label: 'Tırnak stüdyosu', color: '#e17055' },
  { value: 'diger', label: 'Diğer', color: '#636e72' },
]
export const businessTypeLabel = (t: BusinessType) => BUSINESS_TYPES.find((b) => b.value === t)?.label ?? 'Diğer'
