import { describe, expect, it } from 'vitest'
import { addDays, parseHHMM, toHHMM, weekday } from './time'

describe('time', () => {
  it('converts minutes and HH:MM both ways', () => {
    expect(toHHMM(540)).toBe('09:00')
    expect(toHHMM(605)).toBe('10:05')
    expect(parseHHMM('13:45')).toBe(825)
  })
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('returns weekday with 0 = Sunday', () => {
    expect(weekday('2026-11-20')).toBe(5)
    expect(weekday('2026-11-22')).toBe(0)
  })
})
