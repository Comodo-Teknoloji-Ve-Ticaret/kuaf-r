import { Globe, Pencil, Plus, Scissors, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { formatTRY, parseTRY } from '../../domain/money'
import type { CategoryKey, Service, ServiceCategory } from '../../domain/types'
import { useRepos } from '../../infrastructure'
import { Avatar, Badge, Button, cx, Drawer, EmptyState, Field, IconButton, Input, PageHeader, Select, Switch, useConfirm, useToast } from '../../ui'
import './services.css'

const CAT_COLORS: { key: CategoryKey; label: string }[] = [
  { key: 'kesim', label: 'Mavi' }, { key: 'boya', label: 'Mercan' }, { key: 'bakim', label: 'Yeşil' }, { key: 'fon', label: 'Mor' },
  { key: 'tirnak', label: 'Pembe' }, { key: 'sakal', label: 'Altın' }, { key: 'diger', label: 'Gri' },
]

export const tl = (kurus: number) => String(kurus / 100).replace('.', ',')

export default function ServicesPage() {
  const repos = useRepos()
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  const [newCatFor, setNewCatFor] = useState(false)
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState<CategoryKey>('diger')
  const cats = repos.categories.list().sort((a, b) => a.order - b.order)
  const services = repos.services.list()
  const staff = repos.staff.list({ active: true })

  const patch = (s: Service, p: Partial<Service>) => repos.services.upsert({ ...s, ...p })

  return (
    <div className="page">
      <PageHeader
        title="Hizmetler"
        subtitle={`${services.length} hizmet · ${cats.length} kategori`}
        actions={
          <>
            <Button icon={Plus} onClick={() => setNewCatFor(true)}>Kategori</Button>
            <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Yeni hizmet</Button>
          </>
        }
      />
      <div className="svc-cats">
        {cats.map((c) => {
          const list = services.filter((s) => s.categoryId === c.id).sort((a, b) => a.price - b.price)
          return (
            <section key={c.id} className="card svc-cat">
              <header style={{ ['--cc' as string]: `var(--cat-${c.color}-bd)` }}>
                <span className="svc-cat-mark" />
                <h3>{c.name}</h3>
                <span className="muted t-small">{list.length} hizmet</span>
                <div className="spacer" />
                {list.length === 0 && (
                  <IconButton icon={Trash2} label="Kategoriyi sil" onClick={async () => {
                    if (await confirm({ title: 'Kategori silinsin mi?', text: c.name, danger: true, confirm: 'Sil' })) repos.categories.remove(c.id)
                  }} />
                )}
              </header>
              {list.length === 0 ? (
                <p className="muted t-small" style={{ padding: '0 18px 16px' }}>Bu kategoride hizmet yok.</p>
              ) : (
                <div className="svc-rows">
                  {list.map((s) => {
                    const doers = staff.filter((st) => st.serviceIds.includes(s.id))
                    const overrides = Object.keys(s.overrides).length
                    return (
                      <div key={s.id} className="svc-row">
                        <div className="svc-name">
                          <b>{s.name}</b>
                          <div className="row" style={{ gap: 4 }}>
                            <div className="avatars">{doers.slice(0, 4).map((d) => <Avatar key={d.id} name={d.name} color={d.color} size={20} />)}</div>
                            {overrides > 0 && <Badge tone="accent">{overrides} özel fiyat</Badge>}
                          </div>
                        </div>
                        <label className="inline-num">
                          <input type="number" min={5} step={5} defaultValue={s.duration} onBlur={(e) => { const v = Number(e.target.value); if (v >= 5 && v !== s.duration) { patch(s, { duration: v }); toast('Süre güncellendi') } }} />
                          <span>dk</span>
                        </label>
                        <label className="inline-num price">
                          <span>₺</span>
                          <input inputMode="decimal" defaultValue={tl(s.price)} onBlur={(e) => { const v = parseTRY(e.target.value); if (v > 0 && v !== s.price) { patch(s, { price: v }); toast('Fiyat güncellendi') } }} />
                        </label>
                        <div className="svc-online" title="Online randevuda göster">
                          <Globe size={14} className="muted" />
                          <Switch on={s.online} onChange={(v) => patch(s, { online: v })} label="Online randevu" />
                        </div>
                        <IconButton icon={Pencil} label="Düzenle" onClick={() => setEditing(s)} />
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
        {cats.length === 0 && <EmptyState icon={Scissors} title="Henüz kategori yok" action={<Button variant="primary" onClick={() => setNewCatFor(true)}>Kategori ekle</Button>} />}
      </div>

      {editing && <ServiceEditor service={editing === 'new' ? undefined : editing} cats={cats} onClose={() => setEditing(null)} />}
      {newCatFor && (
        <Drawer
          title="Yeni kategori"
          onClose={() => setNewCatFor(false)}
          footer={<><Button variant="ghost" onClick={() => setNewCatFor(false)}>Vazgeç</Button><Button variant="primary" disabled={!catName.trim()} onClick={() => {
            repos.categories.upsert({ name: catName.trim(), color: catColor, order: cats.length })
            toast('Kategori eklendi'); setCatName(''); setNewCatFor(false)
          }}>Ekle</Button></>}
        >
          <Field label="Ad"><Input autoFocus value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Örn. Kaş & Kirpik" /></Field>
          <Field label="Takvim rengi">
            <div className="svc-chips">
              {CAT_COLORS.map((c) => (
                <button key={c.key} className={cx('chip', catColor === c.key && 'on')} onClick={() => setCatColor(c.key)}>
                  <i style={{ width: 12, height: 12, borderRadius: 4, background: `var(--cat-${c.key}-bd)` }} />{c.label}
                </button>
              ))}
            </div>
          </Field>
        </Drawer>
      )}
    </div>
  )
}

function ServiceEditor({ service, cats, onClose }: { service?: Service; cats: ServiceCategory[]; onClose: () => void }) {
  const repos = useRepos()
  const toast = useToast()
  const confirm = useConfirm()
  const staff = repos.staff.list({ active: true })
  const [f, setF] = useState({
    name: service?.name ?? '', categoryId: service?.categoryId ?? cats[0]?.id ?? '', duration: service?.duration ?? 30,
    price: service ? tl(service.price) : '', online: service?.online ?? true, overrides: service?.overrides ?? {},
  })
  const [doers, setDoers] = useState<string[]>(() => staff.filter((s) => (service ? s.serviceIds.includes(service.id) : true)).map((s) => s.id))

  const save = () => {
    const saved = repos.services.upsert({ ...service, name: f.name.trim(), categoryId: f.categoryId, duration: f.duration, price: parseTRY(f.price), online: f.online, overrides: f.overrides })
    for (const s of staff) {
      const has = s.serviceIds.includes(saved.id)
      const want = doers.includes(s.id)
      if (has !== want) repos.staff.upsert({ ...s, serviceIds: want ? [...s.serviceIds, saved.id] : s.serviceIds.filter((x) => x !== saved.id) })
    }
    toast(service ? 'Hizmet güncellendi' : 'Hizmet eklendi')
    onClose()
  }

  const setOverride = (staffId: string, key: 'price' | 'duration', raw: string) => {
    const o = { ...f.overrides }
    const cur = { ...(o[staffId] ?? {}) }
    const v = key === 'price' ? parseTRY(raw) : Number(raw)
    if (!raw || !v) delete cur[key]
    else cur[key] = v
    if (Object.keys(cur).length) o[staffId] = cur
    else delete o[staffId]
    setF({ ...f, overrides: o })
  }

  return (
    <Drawer
      title={service ? 'Hizmeti düzenle' : 'Yeni hizmet'}
      onClose={onClose}
      footer={
        <>
          {service && (
            <Button variant="danger" icon={Trash2} onClick={async () => {
              if (await confirm({ title: 'Hizmet silinsin mi?', text: 'Geçmiş randevu ve adisyonlar etkilenmez.', danger: true, confirm: 'Sil' })) {
                repos.services.remove(service.id); toast('Hizmet silindi'); onClose()
              }
            }}>Sil</Button>
          )}
          <div className="spacer" />
          <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" disabled={!f.name.trim() || parseTRY(f.price) <= 0} onClick={save}>Kaydet</Button>
        </>
      }
    >
      <Field label="Hizmet adı"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Örn. Saç Kesimi" /></Field>
      <div className="grid-3">
        <Field label="Kategori">
          <Select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Süre (dk)">
          <Select value={f.duration} onChange={(e) => setF({ ...f, duration: Number(e.target.value) })}>
            {[10, 15, 20, 30, 40, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240].map((d) => <option key={d} value={d}>{d} dk</option>)}
          </Select>
        </Field>
        <Field label="Fiyat (₺)"><Input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="600" /></Field>
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><div className="t-strong">Online randevuda göster</div><div className="t-small muted">Müşteriler bu hizmeti kendileri seçebilir</div></div>
        <Switch on={f.online} onChange={(v) => setF({ ...f, online: v })} />
      </div>
      <Field label={<span className="row" style={{ gap: 6 }}><Users size={14} /> Bu hizmeti yapanlar ve özel fiyat/süre</span>} hint="Boş bırakılan alanlarda standart değer kullanılır.">
        <div className="override-table">
          {staff.map((s) => {
            const on = doers.includes(s.id)
            return (
              <div key={s.id} className={cx('override-row', !on && 'off')}>
                <label className="row" style={{ gap: 8, flex: 1, cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={() => setDoers((d) => (on ? d.filter((x) => x !== s.id) : [...d, s.id]))} />
                  <Avatar name={s.name} color={s.color} size={26} />
                  <span><b>{s.name}</b><br /><span className="t-small muted">{s.title}</span></span>
                </label>
                <input className="input" style={{ width: 80, height: 34 }} placeholder={`${f.duration} dk`} disabled={!on} defaultValue={f.overrides[s.id]?.duration ?? ''} onChange={(e) => setOverride(s.id, 'duration', e.target.value)} />
                <input className="input" style={{ width: 96, height: 34 }} placeholder={f.price ? `₺${f.price}` : '₺'} disabled={!on} defaultValue={f.overrides[s.id]?.price ? tl(f.overrides[s.id].price!) : ''} onChange={(e) => setOverride(s.id, 'price', e.target.value)} />
              </div>
            )
          })}
        </div>
      </Field>
      {service && <p className="t-small muted">Standart: {f.duration} dk · {formatTRY(parseTRY(f.price))}</p>}
    </Drawer>
  )
}
