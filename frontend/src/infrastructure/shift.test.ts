import { describe, expect, it } from 'vitest'
import { buildSeed } from './seed'
import { shiftDb } from './shift'

describe('shiftDb', () => {
  it('moves every date forward so an old demo looks like today', () => {
    const db = buildSeed('2026-11-20')
    const todays = db.appointments.filter((a) => a.date === '2026-11-20').length
    const shifted = shiftDb(db, 3)
    expect(shifted.seededFor).toBe('2026-11-23')
    expect(shifted.appointments.filter((a) => a.date === '2026-11-23').length).toBe(todays)
    expect(shifted.customerPackages[0].expiresOn).not.toBe(db.customerPackages[0].expiresOn)
    expect(shifted.customers[0].birthday).toBe(db.customers[0].birthday)
  })
})
