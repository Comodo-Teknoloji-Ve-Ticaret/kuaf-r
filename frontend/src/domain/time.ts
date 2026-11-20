import type { Weekday } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toHHMM(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + (m || 0)
}

function toUTC(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUTC(dt: Date): string {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export function addDays(date: string, n: number): string {
  const dt = toUTC(date)
  dt.setUTCDate(dt.getUTCDate() + n)
  return fromUTC(dt)
}

export function weekday(date: string): Weekday {
  return toUTC(date).getUTCDay() as Weekday
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86400000)
}

/** Pazartesi başlangıçlı hafta. */
export function startOfWeek(date: string): string {
  const wd = weekday(date)
  return addDays(date, wd === 0 ? -6 : 1 - wd)
}

function istanbulParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, min: Number(get('hour')) * 60 + Number(get('minute')) }
}

export function todayIstanbul(now?: Date): string {
  return istanbulParts(now).date
}

export function nowMinutesIstanbul(now?: Date): number {
  return istanbulParts(now).min
}

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const DAY_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export const dayName = (date: string) => DAY_NAMES[weekday(date)]
export const dayShort = (date: string) => DAY_SHORT[weekday(date)]
export const weekdayName = (wd: Weekday) => DAY_NAMES[wd]
export function formatDate(date: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const [y, m, d] = date.split('-').map(Number)
  let s = `${d} ${MONTHS[m - 1]}`
  if (opts.year) s += ` ${y}`
  if (opts.weekday) s += ` ${dayName(date)}`
  return s
}
export const monthName = (m: number) => MONTHS[m - 1]
