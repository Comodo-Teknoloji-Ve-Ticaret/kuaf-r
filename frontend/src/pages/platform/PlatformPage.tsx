import { Building2, CalendarDays, ExternalLink, Pause, Play, Plus, Scissors, Users, Wallet } from 'lucide-react'
import { useState } from 'react'
import { platformService, slugify } from '../../application/platformService'
import { ticketTotals } from '../../domain/ticket'
import { addDays, formatDate, todayIstanbul } from '../../domain/time'
import { formatTRY } from '../../domain/money'
import type { Tenant } from '../../domain/types'
import { useDbSnapshot, useStore } from '../../infrastructure'
import { Badge, Button, Drawer, Field, Input, Kpi, PageHeader, Select, useConfirm, useToast } from '../../ui'
import { bookingUrl } from '../settings/SettingsPage'
import '../settings/settings.css'

const PLAN_LABEL = { baslangic: 'Başlangıç', pro: 'Pro', kurumsal: 'Kurumsal' }
const PLAN_PRICE = { baslangic: 79900, pro: 149900, kurumsal: 299900 }

export default function PlatformPage() {
  const db = useDbSnapshot()
  const store = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const [creating, setCreating] = useState(false)
  const today = todayIstanbul()
  const since = addDays(today, -29)
  const active = db.tenants.filter((t) => t.status === 'active')
  const mrr = active.reduce((s, t) => s + PLAN_PRICE[t.plan], 0)

  const stats = (t: Tenant) => ({
    branches: db.branches.filter((b) => b.tenantId === t.id).length,
    staff: db.staff.filter((s) => s.tenantId === t.id && s.active).length,
    appts: db.appointments.filter((a) => a.tenantId === t.id && a.date >= since && a.date <= today).length,
    revenue: db.tickets.filter((k) => k.tenantId === t.id && k.status === 'closed' && k.date >= since).reduce((s, k) => s + ticketTotals(k).total, 0),
  })

  return (
    <div className="page">
      <PageHeader title="Salonlar" subtitle="Comodo platform yönetimi" actions={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Yeni salon</Button>} />
      <div className="kpis" style={{ marginBottom: 16 }}>
        <Kpi icon={Building2} label="Aktif salon" value={`${active.length} / ${db.tenants.length}`} />
        <Kpi icon={Wallet} label="Aylık abonelik geliri (örnek)" value={formatTRY(mrr)} tone="var(--success)" />
        <Kpi icon={CalendarDays} label="Son 30 gün randevu" value={db.appointments.filter((a) => a.date >= since && a.date <= today).length.toLocaleString('tr-TR')} tone="var(--info)" />
        <Kpi icon={Users} label="Kayıtlı müşteri (tüm salonlar)" value={db.customers.length.toLocaleString('tr-TR')} tone="#e84393" />
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Salon</th><th>Paket</th><th className="r">Şube</th><th className="r">Personel</th><th className="r">30 gün randevu</th><th className="r">30 gün ciro</th><th>Durum</th><th /></tr></thead>
            <tbody>
              {db.tenants.map((t) => {
                const s = stats(t)
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <span className="set-ico" style={{ background: t.logoColor, color: '#fff' }}><Scissors /></span>
                        <div><div className="t-strong">{t.name}</div><div className="t-small muted">/{t.slug} · {formatDate(t.createdAt.slice(0, 10), { year: true })}</div></div>
                      </div>
                    </td>
                    <td><Badge tone="accent">{PLAN_LABEL[t.plan]}</Badge></td>
                    <td className="r num">{s.branches}</td>
                    <td className="r num">{s.staff}</td>
                    <td className="r num">{s.appts}</td>
                    <td className="r num t-strong">{formatTRY(Math.round(s.revenue / 100) * 100)}</td>
                    <td>{t.status === 'active' ? <Badge tone="success" dot>Aktif</Badge> : <Badge tone="danger" dot>Askıda</Badge>}</td>
                    <td className="r">
                      <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => window.open(bookingUrl(t.slug), '_blank')}>Sayfa</Button>
                        {t.status === 'active' ? (
                          <Button size="sm" variant="danger" icon={Pause} onClick={async () => {
                            if (await confirm({ title: `${t.name} askıya alınsın mı?`, text: 'Salon kullanıcıları giriş yapamaz ve online randevu kapanır. Veriler silinmez.', danger: true, confirm: 'Askıya al' })) {
                              platformService(store).setStatus(t.id, 'suspended'); toast('Salon askıya alındı')
                            }
                          }}>Askıya al</Button>
                        ) : (
                          <Button size="sm" icon={Play} onClick={() => { platformService(store).setStatus(t.id, 'active'); toast('Salon aktifleştirildi') }}>Aktifleştir</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {creating && <NewSalon onClose={() => setCreating(false)} />}
    </div>
  )
}

function NewSalon({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const toast = useToast()
  const [f, setF] = useState({ name: '', slug: '', ownerName: '', branchName: 'Merkez', plan: 'pro' as Tenant['plan'] })
  const [err, setErr] = useState<string | null>(null)
  const slug = f.slug || slugify(f.name)
  return (
    <Drawer title="Yeni salon" subtitle="Salon, ilk şube ve sahip hesabı oluşturulur" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Vazgeç</Button><Button variant="primary" disabled={!f.name.trim() || !f.ownerName.trim()} onClick={() => {
      const r = platformService(store).createSalon({ ...f, slug })
      if (!r.ok) { setErr(r.error === 'slug_taken' ? 'Bu bağlantı adı kullanılıyor' : 'Bilgileri kontrol edin'); return }
      toast(`${r.tenant.name} oluşturuldu · giriş ekranında görünür`)
      onClose()
    }}>Oluştur</Button></>}>
      <Field label="Salon adı"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Örn. Saç Atölyesi" /></Field>
      <Field label="Bağlantı adı" error={err} hint={`Online randevu: …/#/r/${slug || 'salon-adi'}`}><Input value={f.slug} placeholder={slugify(f.name) || 'salon-adi'} onChange={(e) => { setF({ ...f, slug: e.target.value }); setErr(null) }} /></Field>
      <div className="grid-2">
        <Field label="Salon sahibinin adı"><Input value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} /></Field>
        <Field label="İlk şube"><Input value={f.branchName} onChange={(e) => setF({ ...f, branchName: e.target.value })} /></Field>
      </div>
      <Field label="Paket">
        <Select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as Tenant['plan'] })}>
          {(Object.keys(PLAN_LABEL) as Tenant['plan'][]).map((p) => <option key={p} value={p}>{PLAN_LABEL[p]} · {formatTRY(PLAN_PRICE[p])}/ay</option>)}
        </Select>
      </Field>
      <p className="t-small muted">Hizmetler, personel ve fiyatları salon sahibi kendi panelinden ekler. Paket fiyatları örnektir.</p>
    </Drawer>
  )
}
