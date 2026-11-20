import { CalendarOff, Plus, Trash2, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { isActive, workingRange } from '../../domain/availability'
import { commissionFor } from '../../domain/commission'
import { formatTRY } from '../../domain/money'
import { netLineAmounts } from '../../domain/ticket'
import { addDays, formatDate, parseHHMM, todayIstanbul, toHHMM, weekdayName } from '../../domain/time'
import type { Staff, TimeBlock, Weekday, WeekHours } from '../../domain/types'
import { useSession } from '../../app/session'
import { useRepos } from '../../infrastructure'
import { commissionCtx } from '../../application/commissionCtx'
import { Avatar, Badge, Button, cx, Drawer, Field, IconButton, Input, PageHeader, Segmented, Select, Switch, Tabs, useConfirm, useToast } from '../../ui'
import { CommissionEditor } from './CommissionEditor'
import './staff.css'

const COLORS = ['#e17055', '#0984e3', '#00b894', '#8e6cf0', '#e84393', '#fdcb6e', '#00cec9', '#6c5ce7', '#d63031', '#12a37b']
const WEEK: Weekday[] = [1, 2, 3, 4, 5, 6, 0]

export interface DateRange { from: string; to: string }

export function rangeStats(repos: ReturnType<typeof useRepos>, staff: Staff, range: DateRange) {
  const tickets = repos.tickets.list({ status: 'closed' }).filter((t) => t.date >= range.from && t.date <= range.to)
  let revenue = 0
  let services = 0
  let products = 0
  for (const t of tickets) {
    const net = netLineAmounts(t)
    for (const l of t.lines) {
      if (l.staffId !== staff.id) continue
      if (l.kind === 'service') { revenue += net.get(l.id) ?? 0; services++ }
      else if (l.kind === 'product') { revenue += net.get(l.id) ?? 0; products += l.qty }
      else if (l.kind === 'package_use') services++
    }
  }
  return { revenue, services, products, commission: commissionFor(staff, tickets, commissionCtx(repos)) }
}

export function monthStats(repos: ReturnType<typeof useRepos>, staff: Staff, month: string) {
  return rangeStats(repos, staff, { from: `${month}-01`, to: `${month}-31` })
}

type Preset = 'month' | 'lastMonth' | '7d' | 'today' | 'custom'
function presetRange(p: Preset, today: string): DateRange {
  const first = `${today.slice(0, 7)}-01`
  if (p === 'today') return { from: today, to: today }
  if (p === '7d') return { from: addDays(today, -6), to: today }
  if (p === 'lastMonth') return { from: `${addDays(first, -1).slice(0, 7)}-01`, to: addDays(first, -1) }
  return { from: first, to: today }
}

export default function StaffPage() {
  const repos = useRepos()
  const { branch, branches } = useSession()
  const [open, setOpen] = useState<Staff | 'new' | null>(null)
  const [showAll, setShowAll] = useState(false)
  const today = todayIstanbul()
  const [preset, setPreset] = useState<Preset>('month')
  const [custom, setCustom] = useState<DateRange>(presetRange('month', today))
  const range = preset === 'custom' ? custom : presetRange(preset, today)
  const list = repos.staff.list().filter((s) => showAll || s.branchId === branch?.id)
  const stats = useMemo(() => new Map(list.map((s) => [s.id, rangeStats(repos, s, range)])), [repos, list, range.from, range.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const ranked = [...list].filter((s) => s.active).sort((a, b) => (stats.get(b.id)?.revenue ?? 0) - (stats.get(a.id)?.revenue ?? 0))
  const top = Math.max(1, ...ranked.map((s) => stats.get(s.id)?.revenue ?? 0))
  const totals = ranked.reduce((acc, s) => { const x = stats.get(s.id)!; return { revenue: acc.revenue + x.revenue, commission: acc.commission + x.commission.total } }, { revenue: 0, commission: 0 })

  return (
    <div className="page">
      <PageHeader
        title="Personel"
        subtitle={`${list.filter((s) => s.active).length} aktif çalışan${showAll ? '' : ` · ${branch?.name}`}`}
        actions={
          <>
            {branches.length > 1 && <Button onClick={() => setShowAll((v) => !v)}>{showAll ? 'Bu şube' : 'Tüm şubeler'}</Button>}
            <Button variant="primary" icon={UserPlus} onClick={() => setOpen('new')}>Personel ekle</Button>
          </>
        }
      />
      <div className="staff-filters">
        <Segmented value={preset} onChange={setPreset} options={[{ value: 'today', label: 'Bugün' }, { value: '7d', label: '7 gün' }, { value: 'month', label: 'Bu ay' }, { value: 'lastMonth', label: 'Geçen ay' }, { value: 'custom', label: 'Tarih seç' }]} />
        {preset === 'custom' && (
          <div className="row" style={{ gap: 6 }}>
            <Input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} />
            <span className="muted">–</span>
            <Input type="date" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} />
          </div>
        )}
      </div>

      <div className="card perf-card">
        <div className="card-head">
          <div><h3>Kim ne kadar yaptı?</h3><p className="t-small muted">{formatDate(range.from, { year: true })} – {formatDate(range.to, { year: true })} · kapanmış adisyonlar, indirim sonrası</p></div>
          <div className="perf-total"><span>Toplam</span><b>{formatTRY(Math.round(totals.revenue / 100) * 100)}</b><span>Prim {formatTRY(Math.round(totals.commission / 100) * 100)}</span></div>
        </div>
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="table">
            <thead><tr><th>#</th><th>Personel</th><th style={{ width: '34%' }}>Ciro</th><th className="r">İşlem</th><th className="r">Ürün</th><th className="r">Prim</th></tr></thead>
            <tbody>
              {ranked.map((s, i) => {
                const x = stats.get(s.id)!
                return (
                  <tr key={s.id} className="clickable" onClick={() => setOpen(s)}>
                    <td className="muted num">{i + 1}</td>
                    <td><div className="row" style={{ gap: 10 }}><Avatar name={s.name} color={s.color} size={30} /><div><div className="t-strong">{s.name}</div><div className="t-small muted">{s.commissionMode === 'tiered' ? 'Kademeli prim' : 'Kategori primi'}</div></div></div></td>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <div className="perf-bar"><i style={{ width: `${(x.revenue / top) * 100}%`, background: s.color }} /></div>
                        <b className="num" style={{ minWidth: 92, textAlign: 'right' }}>{formatTRY(Math.round(x.revenue / 100) * 100)}</b>
                      </div>
                    </td>
                    <td className="r num">{x.services}</td>
                    <td className="r num">{x.products}</td>
                    <td className="r num t-strong">{formatTRY(x.commission.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="staff-grid">
        {list.map((s) => {
          const st = stats.get(s.id)!
          const todays = repos.appointments.list({ staffId: s.id, date: today }).filter(isActive)
          const wr = workingRange(s, today)
          const busy = todays.reduce((a, x) => a + x.end - x.start, 0)
          const occ = wr ? Math.min(100, Math.round((busy / (wr.end - wr.start)) * 100)) : 0
          const onLeave = repos.blocks.list({ staffId: s.id, date: today, kind: 'leave' }).length > 0
          return (
            <button key={s.id} className={cx('card staff-card', !s.active && 'inactive')} onClick={() => setOpen(s)}>
              <div className="staff-card-top" style={{ ['--sc' as string]: s.color }}>
                <Avatar name={s.name} color={s.color} size={52} />
                <div>
                  <b>{s.name}</b>
                  <span>{s.title}{showAll && ` · ${repos.branches.get(s.branchId)?.name}`}</span>
                </div>
                {!s.active ? <Badge>Pasif</Badge> : onLeave ? <Badge tone="danger">İzinli</Badge> : !wr ? <Badge>Bugün izin günü</Badge> : <Badge tone="success" dot>{toHHMM(wr.start)}–{toHHMM(wr.end)}</Badge>}
              </div>
              <div className="staff-occ">
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="t-small muted">Bugün {todays.length} randevu</span><span className="t-small t-strong">%{occ}</span></div>
                <div className="occ-track"><i style={{ width: `${occ}%`, background: s.color }} /></div>
              </div>
              <div className="staff-nums">
                <div><span>Ciro</span><b>{formatTRY(Math.round(st.revenue / 100) * 100)}</b></div>
                <div><span>İşlem</span><b>{st.services}</b></div>
                <div><span>Prim</span><b>{formatTRY(st.commission.total)}</b></div>
              </div>
            </button>
          )
        })}
      </div>
      {open && <StaffDetail staff={open === 'new' ? undefined : open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function HoursEditor({ value, onChange }: { value: WeekHours; onChange: (h: WeekHours) => void }) {
  const opts = useMemo(() => Array.from({ length: 4 * 17 }, (_, i) => 360 + i * 15), [])
  return (
    <div className="hours-ed">
      {WEEK.map((d) => {
        const h = value[d]
        return (
          <div key={d} className={cx('hours-row', !h && 'off')}>
            <Switch on={!!h} onChange={(v) => onChange({ ...value, [d]: v ? { open: 540, close: 1140 } : null })} label={weekdayName(d)} />
            <b>{weekdayName(d)}</b>
            {h ? (
              <div className="row" style={{ gap: 6 }}>
                <select className="select" value={h.open} onChange={(e) => onChange({ ...value, [d]: { ...h, open: Number(e.target.value) } })}>
                  {opts.map((m) => <option key={m} value={m}>{toHHMM(m)}</option>)}
                </select>
                <span className="muted">–</span>
                <select className="select" value={h.close} onChange={(e) => onChange({ ...value, [d]: { ...h, close: Number(e.target.value) } })}>
                  {opts.filter((m) => m > h.open).map((m) => <option key={m} value={m}>{toHHMM(m)}</option>)}
                </select>
              </div>
            ) : <span className="muted t-small">Kapalı</span>}
          </div>
        )
      })}
    </div>
  )
}
export { HoursEditor }

function StaffDetail({ staff, onClose }: { staff?: Staff; onClose: () => void }) {
  const repos = useRepos()
  const toast = useToast()
  const confirm = useConfirm()
  const { branch, branches } = useSession()
  const today = todayIstanbul()
  const [tab, setTab] = useState<'profile' | 'hours' | 'leave' | 'services' | 'commission'>('profile')
  const branchHours = repos.branches.get(staff?.branchId ?? branch?.id ?? '')?.hours
  const [f, setF] = useState<Omit<Staff, 'id' | 'tenantId'>>(() => staff ?? {
    branchId: branch?.id ?? '', name: '', title: 'Kuaför', color: COLORS[repos.staff.list().length % COLORS.length], phone: '',
    hours: branchHours ?? { 0: null, 1: { open: 540, close: 1140 }, 2: { open: 540, close: 1140 }, 3: { open: 540, close: 1140 }, 4: { open: 540, close: 1140 }, 5: { open: 540, close: 1140 }, 6: { open: 540, close: 1140 } },
    serviceIds: [], serviceCommission: 35, productCommission: 10, active: true,
    commissionMode: 'category', categoryRates: {}, serviceRates: {}, brandRates: {}, tiers: [{ from: 0, rate: 0 }, { from: 5_000_000, rate: 40 }],
  })
  const [blk, setBlk] = useState({ date: today, kind: 'leave' as TimeBlock['kind'], start: '12:00', end: '13:00', note: '' })
  const cats = repos.categories.list().sort((a, b) => a.order - b.order)
  const services = repos.services.list()
  const blocks = staff ? repos.blocks.list({ staffId: staff.id }).filter((b) => b.date >= today).sort((a, b) => a.date.localeCompare(b.date)) : []
  const month = today.slice(0, 7)
  const st = staff ? monthStats(repos, staff, month) : null

  const save = () => {
    repos.staff.upsert({ ...staff, ...f, name: f.name.trim() })
    toast(staff ? 'Personel güncellendi' : 'Personel eklendi')
    onClose()
  }

  return (
    <Drawer
      wide
      title={staff ? staff.name : 'Yeni personel'}
      subtitle={staff?.title}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Vazgeç</Button><Button variant="primary" disabled={!f.name.trim()} onClick={save}>Kaydet</Button></>}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'profile', label: 'Profil' },
          { value: 'hours', label: 'Mesai' },
          ...(staff ? [{ value: 'leave' as const, label: 'İzin & mola', count: blocks.length }] : []),
          { value: 'services', label: 'Hizmetler', count: f.serviceIds.length },
          { value: 'commission', label: 'Prim' },
        ]}
      />
      {tab === 'profile' && (
        <>
          <div className="grid-2">
            <Field label="Ad Soyad"><Input autoFocus={!staff} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Ünvan"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Kuaför, Renk Uzmanı…" /></Field>
            <Field label="Telefon"><Input value={f.phone} inputMode="tel" onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Şube">
              <Select value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Takvim rengi">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map((c) => <button key={c} className={cx('color-dot', f.color === c && 'on')} style={{ background: c }} onClick={() => setF({ ...f, color: c })} aria-label={c} />)}
            </div>
          </Field>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div><div className="t-strong">Aktif</div><div className="t-small muted">Pasif personel takvimde ve online randevuda görünmez</div></div>
            <Switch on={f.active} onChange={(v) => setF({ ...f, active: v })} />
          </div>
        </>
      )}
      {tab === 'hours' && <HoursEditor value={f.hours} onChange={(hours) => setF({ ...f, hours })} />}
      {tab === 'leave' && staff && (
        <>
          <div className="card card-pad stack" style={{ gap: 10 }}>
            <div className="grid-3">
              <Field label="Tür">
                <Select value={blk.kind} onChange={(e) => setBlk({ ...blk, kind: e.target.value as TimeBlock['kind'] })}>
                  <option value="leave">İzin (tüm gün)</option>
                  <option value="break">Mola</option>
                  <option value="meeting">Toplantı / eğitim</option>
                </Select>
              </Field>
              <Field label="Tarih"><Input type="date" value={blk.date} min={today} onChange={(e) => setBlk({ ...blk, date: e.target.value })} /></Field>
              {blk.kind !== 'leave' && (
                <Field label="Saat">
                  <div className="row" style={{ gap: 4 }}>
                    <Input type="time" step={900} value={blk.start} onChange={(e) => setBlk({ ...blk, start: e.target.value })} />
                    <Input type="time" step={900} value={blk.end} onChange={(e) => setBlk({ ...blk, end: e.target.value })} />
                  </div>
                </Field>
              )}
            </div>
            <Field label="Not"><Input value={blk.note} onChange={(e) => setBlk({ ...blk, note: e.target.value })} placeholder="Yıllık izin, eğitim…" /></Field>
            <div><Button icon={Plus} onClick={() => {
              const full = blk.kind === 'leave'
              const start = full ? 0 : parseHHMM(blk.start)
              const end = full ? 1440 : parseHHMM(blk.end)
              if (end <= start) { toast('Bitiş saati başlangıçtan sonra olmalı', 'error'); return }
              const clash = repos.appointments.list({ staffId: staff.id, date: blk.date }).filter((a) => isActive(a) && a.start < end && start < a.end)
              repos.blocks.upsert({ staffId: staff.id, date: blk.date, start, end, kind: blk.kind, note: blk.note })
              toast(clash.length ? `Eklendi · ${clash.length} randevu çakışıyor, takvimden taşıyın` : 'Eklendi', clash.length ? 'info' : 'success')
            }}>Ekle</Button></div>
          </div>
          <div className="list card">
            {blocks.length === 0 && <p className="muted" style={{ padding: 14 }}>Planlı izin veya mola yok.</p>}
            {blocks.map((b) => (
              <div key={b.id} className="list-item">
                <CalendarOff size={18} className="muted" />
                <div style={{ flex: 1 }}>
                  <div className="t-strong">{formatDate(b.date, { weekday: true })}</div>
                  <div className="t-small muted">{b.kind === 'leave' ? 'Tüm gün izin' : `${b.kind === 'break' ? 'Mola' : 'Toplantı'} · ${toHHMM(b.start)}–${toHHMM(b.end)}`}{b.note && ` · ${b.note}`}</div>
                </div>
                <IconButton icon={Trash2} label="Sil" onClick={async () => { if (await confirm({ title: 'Silinsin mi?', text: formatDate(b.date), danger: true, confirm: 'Sil' })) repos.blocks.remove(b.id) }} />
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'services' && (
        <div className="stack">
          {cats.map((c) => {
            const list = services.filter((s) => s.categoryId === c.id)
            if (!list.length) return null
            const allOn = list.every((s) => f.serviceIds.includes(s.id))
            return (
              <div key={c.id} className="svc-group">
                <h5 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                  <i style={{ width: 8, height: 8, borderRadius: 3, background: `var(--cat-${c.color}-bd)` }} />{c.name}
                  <button className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, serviceIds: allOn ? f.serviceIds.filter((x) => !list.some((s) => s.id === x)) : [...new Set([...f.serviceIds, ...list.map((s) => s.id)])] })}>
                    {allOn ? 'Hiçbiri' : 'Tümü'}
                  </button>
                </h5>
                <div className="svc-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {list.map((s) => (
                    <button key={s.id} className={cx('chip', f.serviceIds.includes(s.id) && 'on')} onClick={() => setF({ ...f, serviceIds: f.serviceIds.includes(s.id) ? f.serviceIds.filter((x) => x !== s.id) : [...f.serviceIds, s.id] })}>{s.name}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {tab === 'commission' && (
        <div className="stack">
          {st && (
            <>
              <div className="cust-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                <div className="mini-stat"><span>Bu ay ciro</span><b>{formatTRY(st.revenue)}</b></div>
                <div className="mini-stat"><span>Hizmet / ürün primi</span><b>{formatTRY(st.commission.service)} / {formatTRY(st.commission.product)}</b></div>
                <div className="mini-stat accent"><span>Bu ay toplam prim</span><b>{formatTRY(st.commission.total)}</b></div>
              </div>
              <p className="t-small muted">Kaydedilmiş ayarlarla hesaplanır. Değişiklikleri görmek için kaydedin.</p>
            </>
          )}
          <CommissionEditor f={f} setF={setF} />
        </div>
      )}
    </Drawer>
  )
}
