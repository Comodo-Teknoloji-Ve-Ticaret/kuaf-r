import { Copy, Heart, Palette, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../../app/session'
import { formatDate, todayIstanbul } from '../../domain/time'
import type { ColorCard, Customer } from '../../domain/types'
import { useRepos } from '../../infrastructure'
import { Badge, Button, cx, EmptyState, Field, IconButton, Input, Select, Textarea, useConfirm, useToast } from '../../ui'

const DEVELOPERS = ['%1,5 (5 vol)', '%3 (10 vol)', '%6 (20 vol)', '%9 (30 vol)', '%12 (40 vol)']
type Draft = Omit<ColorCard, 'id' | 'tenantId'> & { id?: string }

/** Müşteriye özel boya formülleri: hangi boyalar, ne kadar, hangi oksidanla. */
export function ColorCards({ customer }: { customer: Customer }) {
  const repos = useRepos()
  const toast = useToast()
  const confirm = useConfirm()
  const [draft, setDraft] = useState<Draft | null>(null)
  const cards = repos.colorCards.list({ customerId: customer.id }).sort((a, b) => Number(b.liked) - Number(a.liked) || b.date.localeCompare(a.date))
  const staffName = (id?: string) => (id ? repos.staff.get(id)?.name : undefined)

  if (draft) return <ColorCardForm draft={draft} onCancel={() => setDraft(null)} onSaved={() => { setDraft(null); toast('Boya kaydı kaydedildi') }} />

  const blank = (): Draft => ({ customerId: customer.id, date: todayIstanbul(), items: [{ brand: '', shade: '', grams: 30 }], developer: '%6 (20 vol)', processingMin: 35, note: '', liked: false })

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p className="t-small muted">Beğenilen formüller en üstte. Aynı boyayı tekrar yapmak için "Kopyala" ile yeni kayıt açın.</p>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setDraft(blank())}>Yeni boya kaydı</Button>
      </div>
      {cards.length === 0 && <EmptyState icon={Palette} title="Boya kaydı yok" text="Karışımı, numaraları ve oksidanı kaydedin; müşteri beğenirse işaretleyin." />}
      {cards.map((c) => (
        <div key={c.id} className={cx('color-card', c.liked && 'liked')}>
          <div className="cc-head">
            <div>
              <b>{formatDate(c.date, { year: true })}</b>
              <span className="t-small muted">{staffName(c.staffId) ?? 'Personel belirtilmemiş'}</span>
            </div>
            <button className={cx('cc-like', c.liked && 'on')} aria-label="Beğenildi" title={c.liked ? 'Müşteri beğendi' : 'Beğenildi olarak işaretle'} onClick={() => repos.colorCards.upsert({ ...c, liked: !c.liked })}>
              <Heart />{c.liked ? 'Beğenildi' : 'Beğenildi mi?'}
            </button>
          </div>
          <div className="cc-mix">
            {c.items.map((it, i) => (
              <span key={i} className="cc-chip"><b>{it.shade}</b> {it.brand}<em>{it.grams} gr</em></span>
            ))}
            <span className="cc-chip dev">Oksidan {c.developer}</span>
            <span className="cc-chip dev">{c.processingMin} dk</span>
          </div>
          {c.note && <p className="cc-note">{c.note}</p>}
          <div className="cc-actions">
            <Button size="sm" variant="ghost" icon={Copy} onClick={() => setDraft({ ...c, id: undefined, date: todayIstanbul(), liked: false })}>Kopyala</Button>
            <IconButton icon={Pencil} label="Düzenle" onClick={() => setDraft(c)} />
            <IconButton icon={Trash2} label="Sil" onClick={async () => { if (await confirm({ title: 'Boya kaydı silinsin mi?', text: formatDate(c.date, { year: true }), danger: true, confirm: 'Sil' })) repos.colorCards.remove(c.id) }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ColorCardForm({ draft, onCancel, onSaved }: { draft: Draft; onCancel: () => void; onSaved: () => void }) {
  const repos = useRepos()
  const { tenant } = useSession()
  const [f, setF] = useState<Draft>(draft)
  const staff = repos.staff.list({ active: true })
  const brandList = [...new Set([...(tenant?.brands ?? []), ...repos.products.list({ category: 'Boya' }).map((p) => p.brand), 'Majirel', 'Igora', 'Inoa', 'Koleston'])].sort((a, b) => a.localeCompare(b, 'tr'))
  const setItem = (i: number, patch: Partial<Draft['items'][number]>) => setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const valid = f.items.some((i) => i.shade.trim())
  return (
    <div className="card card-pad stack">
      <h3 style={{ fontSize: 15 }}>{draft.id ? 'Boya kaydını düzenle' : 'Yeni boya kaydı'}</h3>
      <div className="grid-2">
        <Field label="Tarih"><Input type="date" value={f.date} onChange={(e) => e.target.value && setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Uygulayan">
          <Select value={f.staffId ?? ''} onChange={(e) => setF({ ...f, staffId: e.target.value || undefined })}>
            <option value="">Seçin…</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Kullanılan boyalar" hint="Birden fazla boya karıştırıldıysa her birini ayrı satır ekleyin.">
        <div className="stack" style={{ gap: 8 }}>
          <datalist id="cc-brands">{brandList.map((b) => <option key={b} value={b} />)}</datalist>
          {f.items.map((it, i) => (
            <div key={i} className="cc-item-row">
              <Input list="cc-brands" placeholder="Marka" value={it.brand} onChange={(e) => setItem(i, { brand: e.target.value })} />
              <Input placeholder="Numara (ör. 7.1)" value={it.shade} onChange={(e) => setItem(i, { shade: e.target.value })} />
              <div className="pay-amount" style={{ width: 110, flex: 'none' }}><input inputMode="numeric" value={it.grams || ''} onChange={(e) => setItem(i, { grams: Number(e.target.value.replace(/\D/g, '')) })} /><span>gr</span></div>
              {f.items.length > 1 && <IconButton icon={Trash2} label="Satırı sil" onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })} />}
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setF({ ...f, items: [...f.items, { brand: f.items[f.items.length - 1]?.brand ?? '', shade: '', grams: 30 }] })}>Boya ekle</Button>
        </div>
      </Field>
      <div className="grid-2">
        <Field label="Oksidan">
          <Input list="cc-dev" value={f.developer} onChange={(e) => setF({ ...f, developer: e.target.value })} />
          <datalist id="cc-dev">{DEVELOPERS.map((d) => <option key={d} value={d} />)}</datalist>
        </Field>
        <Field label="Bekleme süresi (dk)"><Input inputMode="numeric" value={f.processingMin || ''} onChange={(e) => setF({ ...f, processingMin: Number(e.target.value.replace(/\D/g, '')) })} /></Field>
      </div>
      <Field label="Not"><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Uygulama sırası, tonlama, hassasiyet…" /></Field>
      <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.liked} onChange={(e) => setF({ ...f, liked: e.target.checked })} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
        Müşteri bu rengi beğendi <Badge tone="danger">♥</Badge>
      </label>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onCancel}>Vazgeç</Button>
        <Button variant="primary" disabled={!valid} onClick={() => {
          repos.colorCards.upsert({ ...f, items: f.items.filter((i) => i.shade.trim()).map((i) => ({ ...i, brand: i.brand.trim(), shade: i.shade.trim() })) })
          onSaved()
        }}>Kaydet</Button>
      </div>
    </div>
  )
}
