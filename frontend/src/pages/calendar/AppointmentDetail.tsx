import './calendar.css'
import {
  Ban, CalendarClock, Check, CheckCircle2, Footprints, MessageCircle, Pencil, Phone, Receipt, Repeat, Sparkles, UserX,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { appointmentService, SOURCE_LABEL, STATUS_LABEL } from '../../application/appointmentService'
import { cashService } from '../../application/cashService'
import { customerService } from '../../application/customerService'
import { formatTRY } from '../../domain/money'
import { formatPhone, whatsappUrl } from '../../domain/phone'
import { formatDate, toHHMM } from '../../domain/time'
import type { Appointment, AppointmentStatus } from '../../domain/types'
import { useSession } from '../../app/session'
import { useRepos } from '../../infrastructure'
import { Avatar, Badge, Button, Drawer, Field, Modal, Select, useConfirm, useToast, type Tone } from '../../ui'

export const STATUS_TONE: Record<AppointmentStatus, Tone> = {
  pending: 'warning', confirmed: 'accent', arrived: 'info', in_service: 'info', completed: 'success', no_show: 'danger', cancelled: 'neutral',
}

const FLOW: AppointmentStatus[] = ['confirmed', 'arrived', 'in_service', 'completed']

export function AppointmentDetail({ appt, onClose, onEdit }: { appt: Appointment; onClose: () => void; onEdit: () => void }) {
  const repos = useRepos()
  const { tenant, can, user } = useSession()
  const toast = useToast()
  const confirm = useConfirm()
  const nav = useNavigate()
  const svc = appointmentService(repos)
  const [repeatOpen, setRepeatOpen] = useState(false)
  const [every, setEvery] = useState(4)
  const [count, setCount] = useState(3)

  const a = repos.appointments.get(appt.id) ?? appt
  const cust = a.customerId ? repos.customers.get(a.customerId) : undefined
  const staff = repos.staff.get(a.staffId)
  const stats = cust ? customerService(repos).stats(cust.id) : null
  const total = a.items.reduce((s, i) => s + i.price, 0)
  const flowIdx = FLOW.indexOf(a.status)
  const history = cust
    ? repos.appointments.list({ customerId: cust.id }).filter((x) => x.id !== a.id && x.status === 'completed').sort((x, y) => y.date.localeCompare(x.date)).slice(0, 3)
    : []
  const serviceName = (id: string) => repos.services.get(id)?.name ?? 'Hizmet'

  const set = (s: AppointmentStatus, msg: string) => {
    svc.setStatus(a.id, s)
    toast(msg)
  }

  const toCash = () => {
    const t = cashService(repos, user).fromAppointment(a.id)
    if (a.status !== 'completed' && a.status !== 'in_service') svc.setStatus(a.id, 'in_service')
    nav(`/kasa?adisyon=${t.id}`)
  }

  const reminderText = cust
    ? `Merhaba ${cust.name.split(' ')[0]}, ${formatDate(a.date, { weekday: true })} ${toHHMM(a.start)} için ${tenant?.name ?? ''} randevunuzu hatırlatırız (${a.items.map((i) => serviceName(i.serviceId)).join(', ')} – ${staff?.name}). Görüşmek üzere!`
    : ''

  const primary = (() => {
    if (a.status === 'pending') return <Button variant="primary" icon={Check} onClick={() => set('confirmed', 'Randevu onaylandı')}>Onayla</Button>
    if (a.status === 'confirmed') return <Button variant="primary" icon={Footprints} onClick={() => set('arrived', 'Müşteri geldi olarak işaretlendi')}>Geldi</Button>
    if (a.status === 'arrived') return <Button variant="primary" icon={Sparkles} onClick={() => set('in_service', 'İşleme alındı')}>İşleme al</Button>
    if (a.status === 'in_service' && can('cash')) return <Button variant="success" icon={Receipt} onClick={toCash}>Tamamla & ödeme al</Button>
    if (a.status === 'in_service') return <Button variant="success" icon={CheckCircle2} onClick={() => set('completed', 'Tamamlandı')}>Tamamla</Button>
    if (a.status === 'completed' && can('cash')) return <Button icon={Receipt} onClick={toCash}>Adisyonu gör</Button>
    return null
  })()

  return (
    <>
      <Drawer
        title={cust?.name ?? 'Randevusuz müşteri'}
        subtitle={`${a.code} · ${SOURCE_LABEL[a.source]}`}
        onClose={onClose}
        footer={
          <>
            {a.status !== 'completed' && a.status !== 'cancelled' && <Button variant="ghost" icon={Pencil} onClick={onEdit}>Düzenle</Button>}
            <div className="spacer" />
            {primary}
          </>
        }
      >
        <div className="detail-hero">
          <Avatar name={cust?.name ?? '?'} size={48} color={cust ? undefined : 'var(--faint)'} />
          <div>
            <h3>{cust?.name ?? 'Randevusuz müşteri'}</h3>
            {cust && (
              <p>
                <a href={`tel:+90${cust.phone}`}><Phone size={12} /> {formatPhone(cust.phone)}</a>
                {cust.tags.map((t) => <span key={t}> · <Badge tone={t === 'VIP' ? 'warning' : 'neutral'}>{t}</Badge></span>)}
              </p>
            )}
          </div>
          <Badge tone={STATUS_TONE[a.status]} dot>{STATUS_LABEL[a.status]}</Badge>
        </div>

        {flowIdx >= 0 && (
          <div className="status-flow" aria-hidden>
            {FLOW.map((s, i) => <div key={s} className={i < flowIdx ? 'step done' : i === flowIdx ? 'step cur' : 'step'} />)}
          </div>
        )}

        <div className="detail-meta">
          <div><span>Tarih</span><b>{formatDate(a.date, { weekday: true })}</b></div>
          <div><span>Saat</span><b className="num">{toHHMM(a.start)} – {toHHMM(a.end)}</b></div>
          <div><span>Personel</span><b>{staff?.name}</b></div>
          <div><span>Tutar</span><b className="num">{formatTRY(total)}</b></div>
        </div>

        <div className="svc-lines">
          {a.items.map((i, idx) => (
            <div key={idx}><span>{serviceName(i.serviceId)} <span className="muted t-small">· {i.duration} dk</span></span><b className="num">{formatTRY(i.price)}</b></div>
          ))}
        </div>

        {a.note && <div className="note-box">💬 {a.note}</div>}
        {cust?.notes && <div className="note-box">📝 {cust.notes}</div>}

        {stats && (
          <div className="detail-meta">
            <div><span>Ziyaret</span><b>{stats.visits}</b></div>
            <div><span>Toplam harcama</span><b className="num">{formatTRY(stats.totalSpent)}</b></div>
            {stats.noShows > 0 && <div><span>Gelmedi</span><b style={{ color: 'var(--danger)' }}>{stats.noShows} kez</b></div>}
            {stats.balance > 0 && <div><span>Açık borç</span><b style={{ color: 'var(--danger)' }}>{formatTRY(stats.balance)}</b></div>}
          </div>
        )}

        {history.length > 0 && (
          <Field label="Son ziyaretler">
            <div className="history-mini">
              {history.map((h) => (
                <div key={h.id}><span>{formatDate(h.date, { year: true })}</span><span>{h.items.map((i) => serviceName(i.serviceId)).join(', ')}</span></div>
              ))}
            </div>
          </Field>
        )}

        <div className="action-grid">
          {cust && (
            <Button
              icon={MessageCircle}
              onClick={() => {
                repos.messages.upsert({ customerId: cust.id, appointmentId: a.id, kind: 'reminder', channel: 'whatsapp', to: cust.phone, body: reminderText, status: 'opened', at: new Date().toISOString() })
                window.open(whatsappUrl(cust.phone, reminderText), '_blank', 'noopener')
              }}
            >
              WhatsApp hatırlat
            </Button>
          )}
          <Button icon={Repeat} onClick={() => setRepeatOpen(true)}>Tekrarla</Button>
          {cust && <Button icon={CalendarClock} onClick={() => { onClose(); nav(`/musteriler/${cust.id}`) }}>Müşteri kartı</Button>}
          {['pending', 'confirmed', 'arrived'].includes(a.status) && (
            <Button variant="danger" icon={UserX} onClick={() => set('no_show', 'Gelmedi olarak işaretlendi')}>Gelmedi</Button>
          )}
          {!['completed', 'cancelled'].includes(a.status) && (
            <Button
              variant="danger"
              icon={Ban}
              onClick={async () => {
                if (await confirm({ title: 'Randevu iptal edilsin mi?', text: `${cust?.name ?? 'Randevu'} · ${formatDate(a.date)} ${toHHMM(a.start)}`, confirm: 'İptal et', danger: true })) {
                  svc.setStatus(a.id, 'cancelled')
                  toast('Randevu iptal edildi')
                  onClose()
                }
              }}
            >
              İptal et
            </Button>
          )}
        </div>
      </Drawer>

      {repeatOpen && (
        <Modal
          title="Randevuyu tekrarla"
          onClose={() => setRepeatOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRepeatOpen(false)}>Vazgeç</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const out = svc.repeat(a.id, every, count)
                  toast(`${out.length} randevu oluşturuldu`)
                  setRepeatOpen(false)
                }}
              >
                {count} randevu oluştur
              </Button>
            </>
          }
        >
          <p className="muted">Aynı personel, saat ve hizmetlerle ileri tarihlere kopyalanır. Çakışmalar takvimde görünür.</p>
          <div className="grid-2">
            <Field label="Sıklık">
              <Select value={every} onChange={(e) => setEvery(Number(e.target.value))}>
                {[1, 2, 3, 4, 6, 8].map((w) => <option key={w} value={w}>{w === 1 ? 'Her hafta' : `${w} haftada bir`}</option>)}
              </Select>
            </Field>
            <Field label="Adet">
              <Select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[1, 2, 3, 4, 6, 8, 12].map((n) => <option key={n} value={n}>{n} kez</option>)}
              </Select>
            </Field>
          </div>
        </Modal>
      )}
    </>
  )
}
