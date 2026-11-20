import {
  CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Clock3, Footprints, Gauge, Plus, Users, Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { appointmentService } from '../../application/appointmentService'
import { useSession } from '../../app/session'
import { isActive, workingRange } from '../../domain/availability'
import { formatTRY } from '../../domain/money'
import { addDays, dayShort, formatDate, nowMinutesIstanbul, startOfWeek, todayIstanbul, toHHMM } from '../../domain/time'
import type { Appointment, CategoryKey } from '../../domain/types'
import { useRepos } from '../../infrastructure'
import { Avatar, Button, cx, Field, IconButton, Kpi, Modal, Segmented, Select, useConfirm, useIsMobile, useToast } from '../../ui'
import { AppointmentDetail } from './AppointmentDetail'
import { AppointmentForm, CONFLICT_TEXT, CustomerPicker } from './AppointmentForm'
import { TimeGrid, type Column, type GridData } from './TimeGrid'
import type { Customer } from '../../domain/types'
import './calendar.css'

type Panel =
  | { kind: 'new'; staffId: string; date: string; start: number }
  | { kind: 'edit'; appt: Appointment }
  | { kind: 'detail'; appt: Appointment }
  | { kind: 'walkin' }
  | null

function useNow() {
  const [now, setNow] = useState(() => ({ date: todayIstanbul(), min: nowMinutesIstanbul() }))
  useEffect(() => {
    const t = setInterval(() => setNow({ date: todayIstanbul(), min: nowMinutesIstanbul() }), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function CalendarPage() {
  const repos = useRepos()
  const { branch, user, can } = useSession()
  const toast = useToast()
  const confirm = useConfirm()
  const isMobile = useIsMobile()
  const now = useNow()
  const [date, setDate] = useState(now.date)
  const [view, setView] = useState<'day' | 'week'>('day')
  const [panel, setPanel] = useState<Panel>(null)
  const [mobileStaff, setMobileStaff] = useState<string | null>(null)
  const ownOnly = !can('calendar.all')

  const branchId = branch?.id ?? ''
  const allStaff = repos.staff.list({ branchId, active: true })
  const staff = ownOnly ? allStaff.filter((s) => s.id === user?.staffId) : allStaff
  const [weekStaff, setWeekStaff] = useState<string | null>(null)
  const weekStaffId = weekStaff && staff.some((s) => s.id === weekStaff) ? weekStaff : staff[0]?.id
  const activeMobileStaff = mobileStaff && staff.some((s) => s.id === mobileStaff) ? mobileStaff : staff[0]?.id

  const svc = appointmentService(repos)

  // ---- Columns ----
  const effectiveView = isMobile ? 'day' : view
  const columns: Column[] = useMemo(() => {
    if (effectiveView === 'week') {
      const s = staff.find((x) => x.id === weekStaffId)
      if (!s) return []
      const ws = startOfWeek(date)
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(ws, i)
        return {
          key: d, staffId: s.id, date: d, isToday: d === now.date, work: workingRange(s, d, branch?.hours),
          head: <div className="ch-day"><span>{dayShort(d)}</span><b>{Number(d.slice(8))}</b></div>,
        }
      })
    }
    const list = isMobile ? staff.filter((s) => s.id === activeMobileStaff) : staff
    return list.map((s) => {
      const load = repos.appointments.list({ staffId: s.id, date }).filter(isActive).length
      return {
        key: s.id, staffId: s.id, date, isToday: date === now.date, work: workingRange(s, date, branch?.hours),
        head: (
          <>
            <Avatar name={s.name} color={s.color} size={30} />
            <div className="ch-meta"><b>{s.name.split(' ')[0]}</b><span>{s.title}</span></div>
            {load > 0 && <span className="ch-load">{load}</span>}
          </>
        ),
      }
    })
  }, [effectiveView, staff, weekStaffId, date, now.date, branch, isMobile, activeMobileStaff, repos])

  const range = useMemo(() => {
    const ws = columns.map((c) => c.work).filter(Boolean) as { start: number; end: number }[]
    const hrs = branch?.hours
    let start = ws.length ? Math.min(...ws.map((w) => w.start)) : 540
    let end = ws.length ? Math.max(...ws.map((w) => w.end)) : 1200
    if (hrs) {
      const opens = Object.values(hrs).filter(Boolean) as { open: number; close: number }[]
      if (!ws.length && opens.length) { start = Math.min(...opens.map((o) => o.open)); end = Math.max(...opens.map((o) => o.close)) }
    }
    return { start: Math.floor(start / 60) * 60, end: Math.ceil(end / 60) * 60 }
  }, [columns, branch])

  const dates = useMemo(() => new Set(columns.map((c) => c.date)), [columns])
  const data: GridData = useMemo(() => {
    const cats = new Map(repos.categories.list().map((c) => [c.id, c.color]))
    const services = new Map(repos.services.list().map((s) => [s.id, s]))
    return {
      appts: repos.appointments.list().filter((a) => dates.has(a.date) && a.branchId === branchId),
      blocks: repos.blocks.list().filter((b) => dates.has(b.date)),
      customer: (id) => (id ? repos.customers.get(id) : undefined),
      serviceName: (id) => services.get(id)?.name ?? '',
      categoryOf: (id) => (cats.get(services.get(id)?.categoryId ?? '') ?? 'diger') as CategoryKey,
    }
  }, [repos, dates, branchId])

  // ---- KPIs (gün) ----
  const kpi = useMemo(() => {
    const dayAppts = repos.appointments.list({ date }).filter((a) => a.branchId === branchId && (!ownOnly || a.staffId === user?.staffId))
    const active = dayAppts.filter(isActive)
    const revenue = active.reduce((s, a) => s + a.items.reduce((x, i) => x + i.price, 0), 0)
    const inSalon = dayAppts.filter((a) => a.status === 'arrived' || a.status === 'in_service').length
    let capacity = 0
    for (const s of staff) {
      const w = workingRange(s, date, branch?.hours)
      if (w) capacity += w.end - w.start
    }
    const booked = active.reduce((s, a) => s + (a.end - a.start), 0)
    const pending = repos.appointments.list({ status: 'pending' }).filter((a) => a.branchId === branchId && a.date >= now.date)
    return { count: active.length, revenue, inSalon, occ: capacity ? Math.min(100, Math.round((booked / capacity) * 100)) : 0, pending }
  }, [repos, date, branchId, staff, branch, ownOnly, user, now.date])

  // ---- Actions ----
  const doMove = useCallback(async (a: Appointment, to: { staffId: string; date: string; start: number }) => {
    const conflicts = svc.preview({ id: a.id, branchId, staffId: to.staffId, customerId: a.customerId, date: to.date, start: to.start, serviceIds: a.items.map((i) => i.serviceId) })
    const target = repos.staff.get(to.staffId)
    const lacks = a.items.some((i) => !target?.serviceIds.includes(i.serviceId))
    if (conflicts.length || lacks) {
      const text = [...conflicts.map((c) => CONFLICT_TEXT[c]), lacks ? `${target?.name} bu randevudaki bazı hizmetleri yapmıyor.` : ''].filter(Boolean).join(' ')
      if (!(await confirm({ title: 'Yine de taşınsın mı?', text, confirm: 'Taşı' }))) return
    }
    svc.move(a.id, to)
    toast(`Taşındı → ${target?.name.split(' ')[0]}, ${formatDate(to.date)} ${toHHMM(to.start)}`)
  }, [svc, branchId, repos, confirm, toast])

  const doResize = useCallback((a: Appointment, end: number) => {
    const r = svc.resize(a.id, end)
    toast(`Süre: ${r.appt.end - r.appt.start} dk${r.conflicts.length ? ' · çakışma var' : ''}`, r.conflicts.length ? 'info' : 'success')
  }, [svc, toast])

  const step = effectiveView === 'week' ? 7 : 1
  const newAt = useCallback(() => {
    const s = isMobile ? activeMobileStaff : staff[0]?.id
    if (!s) return
    const start = date === now.date ? Math.max(range.start, Math.ceil(now.min / 15) * 15) : range.start
    setPanel({ kind: 'new', staffId: s, date, start: Math.min(start, range.end - 30) })
  }, [isMobile, activeMobileStaff, staff, date, now, range])

  // Klavye kısayolları
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (panel || e.metaKey || e.ctrlKey || (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); newAt() }
      else if (e.key === 't' || e.key === 'T') setDate(now.date)
      else if (e.key === 'ArrowLeft') setDate((d) => addDays(d, -step))
      else if (e.key === 'ArrowRight') setDate((d) => addDays(d, step))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [panel, newAt, now.date, step])

  const title = effectiveView === 'week'
    ? `${formatDate(startOfWeek(date))} – ${formatDate(addDays(startOfWeek(date), 6))}`
    : date === now.date ? 'Bugün' : date === addDays(now.date, 1) ? 'Yarın' : date === addDays(now.date, -1) ? 'Dün' : formatDate(date)
  const sub = effectiveView === 'week' ? '' : formatDate(date, { weekday: true, year: true })

  if (!branch) return <div className="page">Şube bulunamadı.</div>

  return (
    <div className="page cal-page">
      <div className="cal-toolbar">
        <div className="cal-date">
          <IconButton icon={ChevronLeft} label="Önceki" bordered onClick={() => setDate((d) => addDays(d, -step))} />
          <IconButton icon={ChevronRight} label="Sonraki" bordered onClick={() => setDate((d) => addDays(d, step))} />
          <label style={{ position: 'relative', cursor: 'pointer' }}>
            <h1>{title}{sub && <small>{sub}</small>}</h1>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()} aria-label="Tarih seç" />
          </label>
          {date !== now.date && <Button size="sm" onClick={() => setDate(now.date)}>Bugün</Button>}
        </div>
        <div className="spacer" />
        {!isMobile && (
          <Segmented
            value={view}
            onChange={setView}
            options={[{ value: 'day', label: 'Gün', icon: CalendarDays }, { value: 'week', label: 'Hafta', icon: CalendarRange }]}
          />
        )}
        {effectiveView === 'week' && staff.length > 1 && (
          <Select value={weekStaffId} onChange={(e) => setWeekStaff(e.target.value)} style={{ width: 170, height: 38, borderRadius: 999 }}>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
        {!ownOnly && <Button className="hide-m" icon={Footprints} onClick={() => setPanel({ kind: 'walkin' })}>Randevusuz</Button>}
        <Button className="hide-m" variant="primary" icon={Plus} onClick={newAt}>Randevu <kbd style={{ marginLeft: 2, background: 'rgba(255,255,255,.18)', color: 'inherit', borderColor: 'transparent' }}>N</kbd></Button>
      </div>

      <div className="cal-kpis">
        <Kpi icon={CalendarDays} label="Randevu" value={kpi.count} />
        <Kpi icon={Wallet} label="Beklenen ciro" value={formatTRY(kpi.revenue)} tone="var(--success)" />
        <Kpi icon={Users} label="Şu an salonda" value={kpi.inSalon} tone="var(--info)" />
        <Kpi icon={Gauge} label="Doluluk" value={<>%{kpi.occ}<div className="occ-bar"><i style={{ width: `${kpi.occ}%` }} /></div></>} />
        <div
          className={cx('kpi', kpi.pending.length > 0 && 'clickable')}
          onClick={() => kpi.pending[0] && (setDate(kpi.pending[0].date), setPanel({ kind: 'detail', appt: [...kpi.pending].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)[0] }))}
          title="İlk bekleyen randevuyu aç"
        >
          <div className="kpi-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}><Clock3 /></div>
          <div><b>{kpi.pending.length}</b><span>Onay bekleyen</span></div>
        </div>
      </div>

      {isMobile && staff.length > 1 && (
        <div className="staff-strip">
          {staff.map((s) => (
            <button key={s.id} className={cx('staff-pill', s.id === activeMobileStaff && 'on')} onClick={() => setMobileStaff(s.id)}>
              <Avatar name={s.name} color={s.color} size={26} />
              {s.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {columns.length ? (
        <TimeGrid
          columns={columns}
          range={range}
          data={data}
          nowMin={now.min}
          selectedId={panel && 'appt' in panel ? panel.appt.id : null}
          onSlotClick={(c, start) => setPanel({ kind: 'new', staffId: c.staffId, date: c.date, start })}
          onOpen={(a) => setPanel({ kind: 'detail', appt: a })}
          onMove={doMove}
          onResize={doResize}
          minColWidth={effectiveView === 'week' ? 110 : isMobile ? 200 : 150}
        />
      ) : (
        <div className="card card-pad muted">Bu şubede aktif personel yok.</div>
      )}

      <div className="legend">
        {repos.categories.list().sort((a, b) => a.order - b.order).map((c) => (
          <span key={c.id}><i style={{ background: `var(--cat-${c.color}-bd)` }} />{c.name}</span>
        ))}
        <span className="spacer" />
        <span>Sürükleyerek taşı · alt kenardan çekerek uzat · <kbd>N</kbd> yeni · <kbd>T</kbd> bugün · <kbd>←</kbd><kbd>→</kbd> gün</span>
      </div>

      <button className="fab" aria-label="Yeni randevu" onClick={newAt}><Plus /></button>

      {panel?.kind === 'new' && (
        <AppointmentForm branchId={branchId} initial={panel} onClose={() => setPanel(null)} onSaved={(a) => { setPanel(null); setDate(a.date) }} />
      )}
      {panel?.kind === 'edit' && (
        <AppointmentForm branchId={branchId} initial={panel.appt} editing={panel.appt} onClose={() => setPanel(null)} onSaved={(a) => setPanel({ kind: 'detail', appt: a })} />
      )}
      {panel?.kind === 'detail' && (
        <AppointmentDetail appt={panel.appt} onClose={() => setPanel(null)} onEdit={() => setPanel({ kind: 'edit', appt: repos.appointments.get(panel.appt.id) ?? panel.appt })} />
      )}
      {panel?.kind === 'walkin' && <WalkInModal branchId={branchId} onClose={() => setPanel(null)} onDone={(a) => { setPanel(null); setDate(a.date) }} />}
    </div>
  )
}

function WalkInModal({ branchId, onClose, onDone }: { branchId: string; onClose: () => void; onDone: (a: Appointment) => void }) {
  const repos = useRepos()
  const toast = useToast()
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [staffId, setStaffId] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const staff = repos.staff.list({ branchId, active: true })
  const services = repos.services.list().filter((s) => staff.some((st) => st.serviceIds.includes(s.id)))
  const popular = services.slice(0, 12)
  return (
    <Modal
      title="Randevusuz müşteri"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
          <Button
            variant="primary"
            icon={Footprints}
            disabled={!serviceIds.length}
            onClick={() => {
              try {
                const a = appointmentService(repos).walkIn({ branchId, staffId: staffId || undefined, serviceIds, customerId: customer?.id ?? null })
                toast(`${repos.staff.get(a.staffId)?.name} · ${toHHMM(a.start)} başlıyor`)
                onDone(a)
              } catch (e) {
                toast((e as Error).message, 'error')
              }
            }}
          >
            Sıraya al
          </Button>
        </>
      }
    >
      <p className="muted">Hizmeti seçin; boş olan ya da en erken boşalacak personele şimdiki saatten yerleştirilir.</p>
      <Field label="Hizmet">
        <div className="svc-chips">
          {popular.map((s) => (
            <button key={s.id} className={cx('chip', serviceIds.includes(s.id) && 'on')} onClick={() => setServiceIds((x) => (x.includes(s.id) ? x.filter((i) => i !== s.id) : [...x, s.id]))}>
              {s.name}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid-2">
        <Field label="Personel">
          <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">İlk müsait olan</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Müşteri (isteğe bağlı)">
          <CustomerPicker value={customer} onChange={setCustomer} />
        </Field>
      </div>
    </Modal>
  )
}
