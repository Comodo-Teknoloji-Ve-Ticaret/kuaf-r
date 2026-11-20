import './calendar.css'
import { AlertTriangle, Phone, Search, UserPlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { appointmentService, durationFor, priceFor } from '../../application/appointmentService'
import { customerService } from '../../application/customerService'
import type { Conflict } from '../../domain/availability'
import { workingRange } from '../../domain/availability'
import { formatTRY } from '../../domain/money'
import { formatPhone } from '../../domain/phone'
import { formatDate, toHHMM } from '../../domain/time'
import type { Appointment, Customer } from '../../domain/types'
import { useRepos } from '../../infrastructure'
import { Avatar, Badge, Button, cx, Drawer, Field, IconButton, Input, Select, Textarea, useToast } from '../../ui'

export const CONFLICT_TEXT: Record<Conflict, string> = {
  overlap: 'Bu saatte personelin başka bir randevusu veya molası var.',
  off_hours: 'Seçilen saat personelin mesai saatleri dışında.',
  leave: 'Personel bu gün izinli.',
}

interface Props {
  branchId: string
  initial: { staffId: string; date: string; start: number; customerId?: string | null }
  editing?: Appointment
  onClose: () => void
  onSaved: (a: Appointment) => void
}

export function CustomerPicker({ value, onChange }: { value: Customer | null; onChange: (c: Customer | null) => void }) {
  const repos = useRepos()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const svc = customerService(repos)
  const results = useMemo(() => (q.trim().length >= 2 ? svc.search(q).slice(0, 6) : []), [q, repos]) // eslint-disable-line react-hooks/exhaustive-deps

  if (value) {
    return (
      <div className="cust-pick">
        <Avatar name={value.name} size={36} />
        <div>
          <b>{value.name} {value.tags.includes('VIP') && <Badge tone="warning">VIP</Badge>}</b>
          <span>{formatPhone(value.phone)}</span>
        </div>
        <IconButton icon={X} label="Müşteriyi değiştir" onClick={() => onChange(null)} />
      </div>
    )
  }
  if (creating) {
    return (
      <div className="stack" style={{ gap: 10 }}>
        <div className="grid-2">
          <Field label="Ad Soyad">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Elif Kaya" />
          </Field>
          <Field label="Telefon" error={err}>
            <Input icon={Phone} value={phone} onChange={(e) => { setPhone(e.target.value); setErr(null) }} placeholder="0532 111 22 33" inputMode="tel" invalid={!!err} />
          </Field>
        </div>
        <div className="row">
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Vazgeç</Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!name.trim()}
            onClick={() => {
              const res = svc.save({ name, phone, tags: [], notes: '', consentSms: true })
              if (res.ok) { toast('Müşteri eklendi'); onChange(res.customer); return }
              if (res.error === 'duplicate_phone' && res.existingId) {
                const ex = repos.customers.get(res.existingId)!
                toast(`Bu numara ${ex.name} adına kayıtlı; o seçildi.`, 'info')
                onChange(ex)
                return
              }
              setErr('Geçerli bir cep telefonu girin')
            }}
          >
            Kaydet ve seç
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row">
        <div style={{ flex: 1 }}>
          <Input icon={Search} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad veya telefon ile ara…" />
        </div>
        <Button icon={UserPlus} onClick={() => { setCreating(true); const digits = q.replace(/\D/g, ''); if (digits.length >= 7) setPhone(q); else setName(q) }}>Yeni</Button>
      </div>
      {results.length > 0 && (
        <div className="cust-search-results">
          {results.map((c) => (
            <div key={c.id} className="list-item clickable" onClick={() => onChange(c)}>
              <Avatar name={c.name} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-strong">{c.name}</div>
                <div className="t-small muted">{formatPhone(c.phone)}</div>
              </div>
              {c.tags.includes('VIP') && <Badge tone="warning">VIP</Badge>}
            </div>
          ))}
        </div>
      )}
      {q.trim().length >= 2 && results.length === 0 && <p className="t-small muted">Sonuç yok. "Yeni" ile ekleyebilirsiniz.</p>}
      <p className="t-small muted">Müşterisiz kaydetmek için boş bırakın (randevusuz gelen).</p>
    </div>
  )
}

export function AppointmentForm({ branchId, initial, editing, onClose, onSaved }: Props) {
  const repos = useRepos()
  const toast = useToast()
  const svc = appointmentService(repos)
  const staffList = repos.staff.list({ branchId, active: true })
  const categories = repos.categories.list().sort((a, b) => a.order - b.order)
  const allServices = repos.services.list()

  const [customer, setCustomer] = useState<Customer | null>(() => {
    const id = editing?.customerId ?? initial.customerId
    return id ? repos.customers.get(id) ?? null : null
  })
  const [staffId, setStaffId] = useState(editing?.staffId ?? initial.staffId)
  const [date, setDate] = useState(editing?.date ?? initial.date)
  const [start, setStart] = useState(editing?.start ?? initial.start)
  const [serviceIds, setServiceIds] = useState<string[]>(editing?.items.map((i) => i.serviceId) ?? [])
  const [note, setNote] = useState(editing?.note ?? '')

  const staff = repos.staff.get(staffId)
  const services = allServices.filter((s) => staff?.serviceIds.includes(s.id))
  const chosen = serviceIds.map((id) => allServices.find((s) => s.id === id)!).filter(Boolean)
  const duration = chosen.reduce((s, x) => s + durationFor(x, staffId), 0)
  const price = chosen.reduce((s, x) => s + priceFor(x, staffId), 0)
  const branch = repos.branches.get(branchId)
  const wr = staff ? workingRange(staff, date, branch?.hours) : null
  const times = useMemo(() => {
    const out: number[] = []
    const from = Math.min(wr?.start ?? 540, start)
    const to = Math.max(wr?.end ?? 1200, start + 15)
    for (let m = from; m < to; m += 15) out.push(m)
    return out
  }, [wr?.start, wr?.end, start]) // eslint-disable-line react-hooks/exhaustive-deps

  const conflicts = serviceIds.length && staff ? svc.preview({ id: editing?.id, branchId, staffId, customerId: customer?.id ?? null, date, start, serviceIds }) : []
  const missingServices = serviceIds.filter((id) => !staff?.serviceIds.includes(id))

  const toggle = (id: string) => setServiceIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const save = () => {
    const input = { branchId, staffId, customerId: customer?.id ?? null, date, start, serviceIds, note }
    const res = editing ? svc.update(editing.id, input) : svc.create(input)
    toast(editing ? 'Randevu güncellendi' : `Randevu oluşturuldu · ${formatDate(date)} ${toHHMM(start)}`)
    onSaved(res.appt)
  }

  return (
    <Drawer
      title={editing ? 'Randevuyu düzenle' : 'Yeni randevu'}
      subtitle={`${formatDate(date, { weekday: true })} · ${toHHMM(start)}`}
      onClose={onClose}
      footer={
        <>
          <div className="spacer" style={{ alignSelf: 'center' }}>
            {chosen.length > 0 && <span className="t-strong num">{formatTRY(price)} <span className="muted t-small">· {duration} dk</span></span>}
          </div>
          <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" disabled={!serviceIds.length || missingServices.length > 0} onClick={save}>
            {editing ? 'Kaydet' : 'Randevu oluştur'}
          </Button>
        </>
      }
    >
      <Field label="Müşteri">
        <CustomerPicker value={customer} onChange={setCustomer} />
      </Field>
      {customer?.notes && <div className="note-box">📝 {customer.notes}</div>}

      <div className="grid-3">
        <Field label="Personel">
          <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Tarih">
          <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <Field label="Saat">
          <Select value={start} onChange={(e) => setStart(Number(e.target.value))}>
            {times.map((m) => <option key={m} value={m}>{toHHMM(m)}</option>)}
          </Select>
        </Field>
      </div>

      <Field label={`Hizmetler${chosen.length ? ` (${chosen.length})` : ''}`}>
        <div className="stack" style={{ gap: 14 }}>
          {categories.map((c) => {
            const list = services.filter((s) => s.categoryId === c.id)
            if (!list.length) return null
            return (
              <div key={c.id} className="svc-group">
                <h5><i style={{ background: `var(--cat-${c.color}-bd)` }} />{c.name}</h5>
                <div className="svc-chips">
                  {list.map((s) => (
                    <button key={s.id} type="button" className={cx('chip svc-chip', serviceIds.includes(s.id) && 'on')} onClick={() => toggle(s.id)}>
                      {s.name}
                      <small>{durationFor(s, staffId)} dk · {formatTRY(priceFor(s, staffId))}</small>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Field>

      {missingServices.length > 0 && (
        <div className="conflict-box"><AlertTriangle />Seçilen personel bazı hizmetleri yapmıyor; hizmetleri yeniden seçin.</div>
      )}
      {conflicts.map((c) => (
        <div key={c} className="conflict-box"><AlertTriangle />{CONFLICT_TEXT[c]} Yine de kaydedebilirsiniz.</div>
      ))}

      {chosen.length > 0 && (
        <div className="summary-box">
          <div className="sum-row"><span className="muted">Saat</span><b>{toHHMM(start)} – {toHHMM(start + duration)}</b></div>
          <div className="sum-row"><span className="muted">Süre</span><b>{duration} dk</b></div>
          <div className="sum-row"><span className="muted">Tutar</span><b>{formatTRY(price)}</b></div>
        </div>
      )}

      <Field label="Not">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. ilk kez geliyor, fotoğraf getirecek…" rows={2} />
      </Field>
    </Drawer>
  )
}
