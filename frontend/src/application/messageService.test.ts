import { describe, expect, it } from 'vitest'
import { appointmentService } from './appointmentService'
import { messageService } from './messageService'
import { setup } from './testkit'

const clock = () => ({ date: '2026-11-20', min: 600 })

function withTemplates() {
  const r = setup()
  r.templates.upsert({ kind: 'reminder', name: 'Hatırlatma', enabled: true, hoursBefore: 24, body: 'Hatırlatma {musteri}: {tarih} {saat} {hizmet} – {personel}, {salon}' })
  r.customers.upsert({ id: 'm2', name: 'Can Yıldız', phone: '5332223344', tags: [], notes: '', consentSms: false, createdAt: '2026-01-01' })
  return r
}

describe('messageService', () => {
  it('lists tomorrow’s active appointments of consenting customers that were not reminded yet', () => {
    const r = withTemplates()
    const a = appointmentService(r, clock)
    const ok = a.create({ branchId: 'b1', staffId: 's1', customerId: 'm1', date: '2026-11-21', start: 630, serviceIds: ['sv1'] }).appt
    a.create({ branchId: 'b1', staffId: 's1', customerId: 'm2', date: '2026-11-21', start: 700, serviceIds: ['sv1'] }) // izin yok
    const cancelled = a.create({ branchId: 'b1', staffId: 's2', customerId: 'm1', date: '2026-11-21', start: 700, serviceIds: ['sv1'] }).appt
    a.setStatus(cancelled.id, 'cancelled')
    const m = messageService(r, clock)
    expect(m.dueReminders().map((x) => x.id)).toEqual([ok.id])
    expect(m.remindAll()).toBe(1)
    expect(m.dueReminders()).toEqual([])
  })
  it('renders the reminder with appointment details', () => {
    const r = withTemplates()
    const appt = appointmentService(r, clock).create({ branchId: 'b1', staffId: 's1', customerId: 'm1', date: '2026-11-21', start: 630, serviceIds: ['sv1'] }).appt
    const log = messageService(r, clock).send('reminder', { appointmentId: appt.id }, 'sms')
    expect(log.body).toBe('Hatırlatma Elif: 21 Kasım Cumartesi 10:30 Kesim – Ayşe, Test')
    expect(log.status).toBe('simulated')
    expect(log.to).toBe('5321112233')
  })
  it('returns a wa.me url for whatsapp sends', () => {
    const r = withTemplates()
    const appt = appointmentService(r, clock).create({ branchId: 'b1', staffId: 's1', customerId: 'm1', date: '2026-11-21', start: 630, serviceIds: ['sv1'] }).appt
    const log = messageService(r, clock).send('reminder', { appointmentId: appt.id }, 'whatsapp')
    expect(log.url).toMatch(/^https:\/\/wa\.me\/905321112233\?text=/)
  })
})
