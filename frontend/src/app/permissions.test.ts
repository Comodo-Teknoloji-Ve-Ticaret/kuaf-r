import { describe, expect, it } from 'vitest'
import { can } from './permissions'

describe('can', () => {
  it('limits staff to their own calendar', () => {
    expect(can('staff', 'cash')).toBe(false)
    expect(can('staff', 'calendar.all')).toBe(false)
    expect(can('staff', 'calendar')).toBe(true)
  })
  it('lets reception run the desk but not settings or full reports', () => {
    expect(can('reception', 'cash')).toBe(true)
    expect(can('reception', 'calendar.all')).toBe(true)
    expect(can('reception', 'settings')).toBe(false)
    expect(can('reception', 'reports')).toBe(false)
  })
  it('gives owners everything except the platform panel', () => {
    expect(can('owner', 'settings')).toBe(true)
    expect(can('owner', 'reports')).toBe(true)
    expect(can('owner', 'platform')).toBe(false)
    expect(can('platform', 'platform')).toBe(true)
    expect(can('platform', 'cash')).toBe(false)
  })
})
