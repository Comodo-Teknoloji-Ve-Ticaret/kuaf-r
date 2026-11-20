import { weekday } from './time'
import type { Appointment, Staff, TimeBlock, WeekHours } from './types'

export type Range = { start: number; end: number }
export type Conflict = 'overlap' | 'off_hours' | 'leave'

export const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end

/** Takvimde yer kaplayan randevu mu? (iptal / gelmedi yer kaplamaz) */
export const isActive = (a: Appointment) => a.status !== 'cancelled' && a.status !== 'no_show'

export function workingRange(staff: Staff, date: string, branchHours?: WeekHours): Range | null {
  const wd = weekday(date)
  const s = staff.hours[wd]
  if (!s) return null
  const b = branchHours ? branchHours[wd] : s
  if (!b) return null
  const start = Math.max(s.open, b.open)
  const end = Math.min(s.close, b.close)
  return end > start ? { start, end } : null
}

export function conflictsFor(appt: Appointment, appts: Appointment[], blocks: TimeBlock[], staff: Staff): Conflict[] {
  const out = new Set<Conflict>()
  const mine = blocks.filter((b) => b.staffId === appt.staffId && b.date === appt.date && overlaps(b, appt))
  if (mine.some((b) => b.kind === 'leave')) out.add('leave')
  const wr = workingRange(staff, appt.date)
  if (!wr || appt.start < wr.start || appt.end > wr.end) out.add('off_hours')
  const clash = appts.some(
    (o) => o.id !== appt.id && o.staffId === appt.staffId && o.date === appt.date && isActive(o) && overlaps(o, appt),
  )
  if (clash || mine.some((b) => b.kind !== 'leave')) out.add('overlap')
  return (['leave', 'off_hours', 'overlap'] as Conflict[]).filter((c) => out.has(c))
}

export interface SlotQuery {
  date: string
  duration: number
  staff: Staff[]
  appts: Appointment[]
  blocks: TimeBlock[]
  branchHours?: WeekHours
  step?: number
  today?: string
  nowMin?: number
  minLeadMin?: number
}

export function findSlots(q: SlotQuery): { staffId: string; start: number }[] {
  const step = q.step ?? 15
  const out: { staffId: string; start: number }[] = []
  let earliest = 0
  if (q.today && q.date < q.today) return []
  if (q.today === q.date && q.nowMin !== undefined) earliest = q.nowMin + (q.minLeadMin ?? 0)
  for (const s of q.staff) {
    if (!s.active) continue
    const wr = workingRange(s, q.date, q.branchHours)
    if (!wr) continue
    const busy: Range[] = [
      ...q.appts.filter((a) => a.staffId === s.id && a.date === q.date && isActive(a)),
      ...q.blocks.filter((b) => b.staffId === s.id && b.date === q.date),
    ]
    const first = Math.ceil(Math.max(wr.start, earliest) / step) * step
    for (let t = first; t + q.duration <= wr.end; t += step) {
      const r = { start: t, end: t + q.duration }
      if (!busy.some((b) => overlaps(b, r))) out.push({ staffId: s.id, start: t })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}
