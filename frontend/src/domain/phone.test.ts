import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it('treats all common Turkish mobile spellings as the same number', () => {
    expect(normalizePhone('0532 111 22 33')).toBe('5321112233')
    expect(normalizePhone('+90 532 111 2233')).toBe('5321112233')
    expect(normalizePhone('5321112233')).toBe('5321112233')
    expect(normalizePhone('(0532) 111-22-33')).toBe('5321112233')
    expect(normalizePhone('905321112233')).toBe('5321112233')
  })
  it('rejects numbers that are too short', () => {
    expect(normalizePhone('123')).toBeNull()
    expect(normalizePhone('')).toBeNull()
  })
  it('formats as 0532 111 22 33', () => {
    expect(formatPhone('5321112233')).toBe('0532 111 22 33')
  })
})
