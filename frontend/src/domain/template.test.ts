import { describe, expect, it } from 'vitest'
import { renderTemplate } from './template'

describe('renderTemplate', () => {
  it('fills known variables and leaves unknown ones as written', () => {
    expect(renderTemplate('Merhaba {musteri}, {saat} {salon} {bilinmeyen}', { musteri: 'Elif', saat: '10:30', salon: 'Studio Lara' }))
      .toBe('Merhaba Elif, 10:30 Studio Lara {bilinmeyen}')
  })
  it('replaces repeated variables', () => {
    expect(renderTemplate('{a}-{a}', { a: 'x' })).toBe('x-x')
  })
})
