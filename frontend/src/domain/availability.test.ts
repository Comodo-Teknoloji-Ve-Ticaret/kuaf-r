import { describe, expect, it } from 'vitest'
import { conflictsFor, findSlots, overlaps } from './availability'
import { mkAppt, mkStaff } from './testkit'

describe('overlaps', () => {
  it('back-to-back ranges do not overlap', () => {
    expect(overlaps({ start: 600, end: 660 }, { start: 660, end: 720 })).toBe(false)
    expect(overlaps({ start: 600, end: 661 }, { start: 660, end: 720 })).toBe(true)
  })
})

describe('findSlots', () => {
  const staff = [mkStaff()]
  const appts = [mkAppt({ start: 600, end: 660 })]
  it('returns only free 15-minute aligned starts inside working hours', () => {
    const slots = findSlots({ date: '2026-11-20', duration: 60, staff, appts, blocks: [] })
    expect(slots.map((s) => s.start)).toEqual([540, 660])
  })
  it('respects minimum lead time on today', () => {
    const slots = findSlots({ date: '2026-11-20', duration: 60, staff, appts, blocks: [], today: '2026-11-20', nowMin: 540, minLeadMin: 120 })
    expect(slots.map((s) => s.start)).toEqual([660])
  })
  it('ignores cancelled and no-show appointments', () => {
    const slots = findSlots({ date: '2026-11-20', duration: 60, staff, appts: [mkAppt({ status: 'cancelled' })], blocks: [] })
    expect(slots.map((s) => s.start)).toContain(600)
  })
  it('returns nothing on a closed day', () => {
    expect(findSlots({ date: '2026-11-22', duration: 30, staff, appts: [], blocks: [] })).toEqual([])
  })
  it('intersects staff hours with branch hours', () => {
    const branchHours = { ...mkStaff().hours, 5: { open: 600, close: 720 } }
    const slots = findSlots({ date: '2026-11-20', duration: 60, staff, appts: [], blocks: [], branchHours })
    expect(slots[0].start).toBe(600)
  })
})

describe('conflictsFor', () => {
  const staff = mkStaff()
  it('flags leave', () => {
    const c = conflictsFor(mkAppt({ id: 'x' }), [], [{ id: 'b', tenantId: 't1', staffId: 's1', date: '2026-11-20', start: 0, end: 1440, kind: 'leave', note: '' }], staff)
    expect(c).toEqual(['leave'])
  })
  it('flags off hours', () => {
    expect(conflictsFor(mkAppt({ id: 'x', start: 700, end: 760 }), [], [], staff)).toEqual(['off_hours'])
  })
  it('flags overlap with another appointment but not itself', () => {
    const a = mkAppt({ id: 'a1' })
    expect(conflictsFor(a, [a], [], staff)).toEqual([])
    expect(conflictsFor(mkAppt({ id: 'a2', start: 630, end: 690 }), [a], [], staff)).toEqual(['overlap'])
  })
})
