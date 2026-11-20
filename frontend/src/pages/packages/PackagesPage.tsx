import { Gift, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatTRY, parseTRY } from '../../domain/money'
import { formatDate, todayIstanbul } from '../../domain/time'
import type { PackageDef } from '../../domain/types'
import { useRepos } from '../../infrastructure'
import { Avatar, Badge, Button, cx, Drawer, EmptyState, Field, IconButton, Input, PageHeader, Select, Switch, Tabs, useToast } from '../../ui'
import { tl } from '../services/ServicesPage'
import '../stock/stock.css'
import '../customers/customers.css'

export default function PackagesPage() {
  const repos = useRepos()
  const nav = useNavigate()
  const [tab, setTab] = useState<'defs' | 'sold'>('defs')
  const [edit, setEdit] = useState<PackageDef | 'new' | null>(null)
  const defs = repos.packageDefs.list()
  const sold = repos.customerPackages.list().sort((a, b) => b.soldOn.localeCompare(a.soldOn))
  const today = todayIstanbul()
  const svc = (id: string) => repos.services.get(id)

  return (
    <div className="page">
      <PageHeader title="Paketler" subtitle="Seans paketleri ve müşteriye satılmış paketler" actions={<Button variant="primary" icon={Plus} onClick={() => setEdit('new')}>Yeni paket</Button>} />
      <Tabs value={tab} onChange={setTab} options={[{ value: 'defs', label: 'Paket tanımları', count: defs.length }, { value: 'sold', label: 'Satılan paketler', count: sold.length }]} />
      <div style={{ marginTop: 16 }}>
        {tab === 'defs' && (
          <div className="pkg-grid">
            {defs.length === 0 && <EmptyState icon={Gift} title="Henüz paket yok" />}
            {defs.map((d) => {
              const normal = d.items.reduce((s, i) => s + (svc(i.serviceId)?.price ?? 0) * i.count, 0)
              const save = normal > d.price ? Math.round((1 - d.price / normal) * 100) : 0
              return (
                <div key={d.id} className={cx('card pkg-def', !d.active && 'inactive')}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <h3>{d.name}</h3>
                    <IconButton icon={Pencil} label="Düzenle" onClick={() => setEdit(d)} />
                  </div>
                  <div className="pkg-price">{formatTRY(d.price)}{save > 0 && <small>{formatTRY(normal)}</small>}</div>
                  {save > 0 && <Badge tone="success">%{save} avantaj</Badge>}
                  <div className="pkg-items">
                    {d.items.map((i) => <div key={i.serviceId}><span>{svc(i.serviceId)?.name}</span><b>× {i.count}</b></div>)}
                  </div>
                  <p className="t-small muted">{d.validDays} gün geçerli · {sold.filter((s) => s.packageDefId === d.id).length} satış{!d.active && ' · pasif'}</p>
                </div>
              )
            })}
          </div>
        )}
        {tab === 'sold' && (
          <div className="card">
            {sold.length === 0 && <EmptyState icon={Gift} title="Satılmış paket yok" text="Kasada adisyona 'Paket sat' ile eklenir." />}
            <div className="list">
              {sold.map((s) => {
                const c = repos.customers.get(s.customerId)
                const d = repos.packageDefs.get(s.packageDefId)
                const expired = s.expiresOn < today
                const left = Object.values(s.remaining).reduce((a, b) => a + b, 0)
                const total = d?.items.reduce((a, b) => a + b.count, 0) ?? left
                return (
                  <div key={s.id} className={cx('list-item clickable', expired && 'expired')} style={expired ? { opacity: 0.55 } : undefined} onClick={() => c && nav(`/musteriler/${c.id}`)}>
                    <Avatar name={c?.name ?? '?'} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="t-strong">{c?.name}</div>
                      <div className="t-small muted">{d?.name} · {formatDate(s.soldOn)} satıldı</div>
                    </div>
                    <div className="pkg-dots">{Array.from({ length: total }, (_, i) => <i key={i} className={i < left ? 'on' : ''} />)}</div>
                    <Badge tone={expired ? 'neutral' : left === 0 ? 'neutral' : 'success'}>{expired ? 'Süresi doldu' : left === 0 ? 'Bitti' : `${left} seans · ${formatDate(s.expiresOn)}`}</Badge>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      {edit && <PackageEditor def={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function PackageEditor({ def, onClose }: { def?: PackageDef; onClose: () => void }) {
  const repos = useRepos()
  const toast = useToast()
  const services = repos.services.list()
  const [f, setF] = useState({ name: def?.name ?? '', price: def ? tl(def.price) : '', validDays: def?.validDays ?? 90, active: def?.active ?? true, items: def?.items ?? [{ serviceId: services[0]?.id ?? '', count: 5 }] })
  const normal = f.items.reduce((s, i) => s + (services.find((x) => x.id === i.serviceId)?.price ?? 0) * i.count, 0)
  return (
    <Drawer title={def ? 'Paketi düzenle' : 'Yeni paket'} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Vazgeç</Button><Button variant="primary" disabled={!f.name.trim() || parseTRY(f.price) <= 0 || !f.items.length} onClick={() => {
      repos.packageDefs.upsert({ ...def, name: f.name.trim(), price: parseTRY(f.price), validDays: f.validDays, active: f.active, items: f.items.filter((i) => i.serviceId && i.count > 0) })
      toast('Paket kaydedildi'); onClose()
    }}>Kaydet</Button></>}>
      <Field label="Paket adı"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Örn. 10'lu Fön Kartı" /></Field>
      <Field label="İçerik">
        <div className="stack" style={{ gap: 8 }}>
          {f.items.map((it, i) => (
            <div key={i} className="row">
              <Select value={it.serviceId} onChange={(e) => setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, serviceId: e.target.value } : x)) })}>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Input type="number" min={1} style={{ width: 80 }} value={it.count} onChange={(e) => setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, count: Number(e.target.value) } : x)) })} />
              <IconButton icon={Trash2} label="Kaldır" onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setF({ ...f, items: [...f.items, { serviceId: services[0]?.id ?? '', count: 1 }] })}>Hizmet ekle</Button>
        </div>
      </Field>
      <div className="grid-2">
        <Field label="Paket fiyatı (₺)" hint={normal ? `Tek tek: ${formatTRY(normal)}` : undefined}><Input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
        <Field label="Geçerlilik (gün)"><Input type="number" min={1} value={f.validDays} onChange={(e) => setF({ ...f, validDays: Number(e.target.value) })} /></Field>
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><div className="t-strong">Satışta</div><div className="t-small muted">Pasif paketler kasada görünmez</div></div>
        <Switch on={f.active} onChange={(v) => setF({ ...f, active: v })} />
      </div>
    </Drawer>
  )
}
