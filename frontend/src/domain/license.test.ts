import { describe, expect, it } from 'vitest'
import { GRACE_DAYS, licenseStatus } from './license'

describe('licenseStatus', () => {
  it('counts used and remaining days', () => {
    expect(licenseStatus({ start: '2026-11-15', days: 30 }, '2026-11-20')).toMatchObject({ end: '2026-12-15', used: 5, remaining: 25, state: 'active' })
  })
  it('is expiring within the last 7 days', () => {
    expect(licenseStatus({ start: '2026-10-28', days: 30 }, '2026-11-20')).toMatchObject({ remaining: 7, state: 'expiring' })
  })
  it('gives a grace period after expiry, then locks', () => {
    expect(GRACE_DAYS).toBe(3)
    expect(licenseStatus({ start: '2026-10-20', days: 30 }, '2026-11-20')).toMatchObject({ remaining: -1, state: 'grace', graceLeft: 2 })
    expect(licenseStatus({ start: '2026-10-20', days: 30 }, '2026-11-22')).toMatchObject({ state: 'grace', graceLeft: 0 })
    expect(licenseStatus({ start: '2026-10-20', days: 30 }, '2026-11-23')).toMatchObject({ state: 'locked' })
  })
  it('expires at the end of the last day', () => {
    expect(licenseStatus({ start: '2026-10-21', days: 30 }, '2026-11-20')).toMatchObject({ remaining: 0, state: 'expiring' })
  })
})
