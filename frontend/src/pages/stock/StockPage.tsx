import { AlertTriangle, ArrowDownToLine, ClipboardCheck, Minus, Package, PackagePlus, Pencil, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { trLower } from '../../application/customerService'
import { stockService } from '../../application/stockService'
import { formatTRY, parseTRY } from '../../domain/money'
import { formatDate } from '../../domain/time'
import type { Product } from '../../domain/types'
import { useRepos } from '../../infrastructure'
import { Badge, Button, cx, Drawer, EmptyState, Field, IconButton, Input, Kpi, Modal, PageHeader, Segmented, Select, useToast } from '../../ui'
import { tl } from '../services/ServicesPage'
import './stock.css'

type MoveKind = 'in' | 'use' | 'count'
const MOVE_LABEL = { in: 'Giriş', sale: 'Satış', use: 'Kullanım', adjust: 'Sayım farkı' }

export default function StockPage() {
  const repos = useRepos()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | 'retail' | 'professional' | 'critical'>('all')
  const [move, setMove] = useState<{ p: Product; kind: MoveKind } | null>(null)
  const [edit, setEdit] = useState<Product | 'new' | null>(null)
  const [history, setHistory] = useState<Product | null>(null)
  const products = repos.products.list()
  const list = useMemo(() => {
    const t = trLower(q)
    return products
      .filter((p) => !t || trLower(p.name).includes(t) || trLower(p.brand).includes(t))
      .filter((p) => (kind === 'critical' ? p.stock <= p.critical : kind === 'all' || p.kind === kind))
      .sort((a, b) => Number(b.stock <= b.critical) - Number(a.stock <= a.critical) || a.name.localeCompare(b.name, 'tr'))
  }, [products, q, kind])
  const critical = products.filter((p) => p.stock <= p.critical)
  const value = products.reduce((s, p) => s + Math.max(0, p.stock) * p.cost, 0)

  return (
    <div className="page">
      <PageHeader title="Stok" subtitle={`${products.length} ürün`} actions={<Button variant="primary" icon={PackagePlus} onClick={() => setEdit('new')}>Ürün ekle</Button>} />
      <div className="kpis" style={{ marginBottom: 16 }}>
        <Kpi icon={Package} label="Ürün çeşidi" value={products.length} />
        <Kpi icon={AlertTriangle} label="Kritik seviyede" value={critical.length} tone="var(--danger)" />
        <Kpi icon={ArrowDownToLine} label="Stok değeri (alış)" value={formatTRY(value)} tone="var(--success)" />
      </div>
      {critical.length > 0 && (
        <div className="crit-banner">
          <AlertTriangle />
          <span><b>{critical.length} ürün</b> kritik seviyede: {critical.slice(0, 4).map((p) => p.name).join(', ')}{critical.length > 4 && '…'}</span>
          <Button size="sm" onClick={() => setKind('critical')}>Göster</Button>
        </div>
      )}
      <div className="card">
        <div className="cust-toolbar" style={{ display: 'flex', gap: 12, padding: 14, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}><Input icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ürün veya marka ara…" /></div>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'all', label: 'Tümü' }, { value: 'retail', label: 'Satış' }, { value: 'professional', label: 'Salon kullanımı' }, { value: 'critical', label: 'Kritik' }]} />
        </div>
        <div className="stock-list">
          {list.length === 0 && <EmptyState icon={Package} title="Ürün yok" />}
          {list.map((p) => {
            const low = p.stock <= p.critical
            const pct = Math.min(100, Math.round((Math.max(0, p.stock) / Math.max(1, p.critical * 3)) * 100))
            return (
              <div key={p.id} className={cx('stock-row', low && 'low')}>
                <div className="stock-main" onClick={() => setHistory(p)}>
                  <b>{p.name}</b>
                  <span className="t-small muted">{p.brand} · {p.category} · {p.kind === 'retail' ? `Satış ${formatTRY(p.price)}` : 'Salon kullanımı'}</span>
                </div>
                <div className="stock-level">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <b className="num">{p.stock} <span className="muted t-small">adet</span></b>
                    {low && <Badge tone="danger">Kritik ({p.critical})</Badge>}
                  </div>
                  <div className="occ-track"><i style={{ width: `${pct}%`, background: low ? 'var(--danger)' : 'var(--success)' }} /></div>
                </div>
                <div className="stock-actions">
                  <Button size="sm" icon={ArrowDownToLine} onClick={() => setMove({ p, kind: 'in' })}>Giriş</Button>
                  <IconButton icon={Minus} label="Kullanım / fire" onClick={() => setMove({ p, kind: 'use' })} />
                  <IconButton icon={ClipboardCheck} label="Sayım" onClick={() => setMove({ p, kind: 'count' })} />
                  <IconButton icon={Pencil} label="Düzenle" onClick={() => setEdit(p)} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {move && <MoveModal p={move.p} kind={move.kind} onClose={() => setMove(null)} onDone={(msg) => { toast(msg); setMove(null) }} />}
      {edit && <ProductEditor product={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {history && (
        <Drawer title={history.name} subtitle="Stok hareketleri" onClose={() => setHistory(null)}>
          <div className="list card">
            {repos.stockMoves.list({ productId: history.id }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60).map((m) => (
              <div key={m.id} className="list-item">
                <div style={{ flex: 1 }}><div className="t-strong">{MOVE_LABEL[m.kind]}</div><div className="t-small muted">{formatDate(m.date, { year: true })}{m.note && ` · ${m.note}`}</div></div>
                <b className="num" style={{ color: m.qty > 0 ? 'var(--success)' : 'var(--danger)' }}>{m.qty > 0 ? '+' : ''}{m.qty}</b>
              </div>
            ))}
          </div>
        </Drawer>
      )}
    </div>
  )
}

function MoveModal({ p, kind, onClose, onDone }: { p: Product; kind: MoveKind; onClose: () => void; onDone: (m: string) => void }) {
  const repos = useRepos()
  const [qty, setQty] = useState(kind === 'count' ? String(p.stock) : '1')
  const [note, setNote] = useState('')
  const title = kind === 'in' ? 'Stok girişi' : kind === 'use' ? 'Kullanım / fire' : 'Sayım'
  const n = Number(qty)
  return (
    <Modal title={`${title} · ${p.name}`} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Vazgeç</Button><Button variant="primary" disabled={!(n > 0 || (kind === 'count' && n >= 0))} onClick={() => {
      const s = stockService(repos)
      if (kind === 'in') s.receive(p.id, n, note)
      else if (kind === 'use') s.use(p.id, n, note)
      else s.count(p.id, n, note || 'Sayım')
      onDone(`${p.name}: stok güncellendi`)
    }}>Kaydet</Button></>}>
      <p className="muted">Mevcut stok: <b>{p.stock}</b></p>
      <Field label={kind === 'count' ? 'Sayılan adet' : 'Adet'}><Input type="number" min={0} autoFocus value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
      {kind === 'count' && n !== p.stock && <p className="t-small" style={{ color: n > p.stock ? 'var(--success)' : 'var(--danger)' }}>Fark: {n - p.stock > 0 ? '+' : ''}{n - p.stock}</p>}
      <Field label="Not"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'in' ? 'Tedarikçi, fatura no…' : ''} /></Field>
    </Modal>
  )
}

function ProductEditor({ product, onClose }: { product?: Product; onClose: () => void }) {
  const repos = useRepos()
  const toast = useToast()
  const [f, setF] = useState({
    name: product?.name ?? '', brand: product?.brand ?? '', category: product?.category ?? 'Bakım', kind: product?.kind ?? 'retail',
    price: product ? tl(product.price) : '', cost: product ? tl(product.cost) : '', critical: product?.critical ?? 3, barcode: product?.barcode ?? '', stock: product?.stock ?? 0,
  })
  return (
    <Drawer title={product ? 'Ürünü düzenle' : 'Yeni ürün'} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Vazgeç</Button><Button variant="primary" disabled={!f.name.trim()} onClick={() => {
      const saved = repos.products.upsert({ ...product, name: f.name.trim(), brand: f.brand, category: f.category, kind: f.kind as Product['kind'], price: parseTRY(f.price), cost: parseTRY(f.cost), critical: Number(f.critical), barcode: f.barcode || undefined, stock: product?.stock ?? 0 })
      if (!product && Number(f.stock) > 0) stockService(repos).receive(saved.id, Number(f.stock), 'Açılış stoku')
      toast(product ? 'Ürün güncellendi' : 'Ürün eklendi'); onClose()
    }}>Kaydet</Button></>}>
      <Field label="Ürün adı"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid-2">
        <Field label="Marka"><Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} /></Field>
        <Field label="Kategori"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['Şampuan', 'Bakım', 'Boya', 'Şekillendirici', 'Tırnak', 'Sakal', 'Tıraş', 'Diğer'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
      </div>
      <Field label="Tür">
        <Segmented value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={[{ value: 'retail', label: 'Satış ürünü' }, { value: 'professional', label: 'Salon kullanımı' }]} />
      </Field>
      <div className="grid-3">
        <Field label="Alış (₺)"><Input inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></Field>
        {f.kind === 'retail' && <Field label="Satış (₺)"><Input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>}
        <Field label="Kritik seviye"><Input type="number" min={0} value={f.critical} onChange={(e) => setF({ ...f, critical: Number(e.target.value) })} /></Field>
      </div>
      {!product && <Field label="Açılış stoku"><Input type="number" min={0} value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} /></Field>}
      <Field label="Barkod (isteğe bağlı)"><Input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} /></Field>
    </Drawer>
  )
}
