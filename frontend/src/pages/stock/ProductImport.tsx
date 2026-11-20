import { AlertTriangle, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { detectColumns, FIELD_LABEL, importProducts, planImport, vatIncludedHint, type ColumnMap, type ImportField } from '../../application/productImport'
import { formatTRY, withVat } from '../../domain/money'
import { useRepos } from '../../infrastructure'
import { readSheet, type Rows } from '../../infrastructure/sheetReader'
import { Badge, Button, cx, Modal, Select, Switch, useToast } from '../../ui'

const FIELDS: ImportField[] = ['name', 'brand', 'category', 'barcode', 'cost', 'price', 'vatRate', 'stock', 'critical', 'kind']
const VAT_RATES = [0, 1, 10, 20]
const TEMPLATE = '﻿Ürün Adı;Marka;Kategori;Barkod;Alış Fiyatı;Satış Fiyatı;KDV;Stok;Kritik;Tür\nOnarıcı Şampuan 300 ml;Loreal;Şampuan;8690000000001;200,00;360,00;20;12;3;Satış\nOksidan %6 1000 ml;Wella;Boya;;150,00;;20;5;2;Salon kullanımı\n'

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = 'urun-sablonu.csv'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ProductImport({ onClose }: { onClose: () => void }) {
  const repos = useRepos()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; rows: Rows } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [map, setMap] = useState<ColumnMap>({})
  const [incl, setIncl] = useState({ cost: false, price: false })
  const [defaultVat, setDefaultVat] = useState(20)

  const load = async (f: File) => {
    setError(''); setBusy(true)
    try {
      const rows = await readSheet(await f.arrayBuffer(), f.name)
      if (rows.length < 2) throw new Error('Dosyada başlık satırının altında ürün bulunamadı.')
      const m = detectColumns(rows[0])
      setMap(m)
      setIncl(vatIncludedHint(rows[0], m))
      setFile({ name: f.name, rows })
    } catch (e) {
      setError(f.name.toLowerCase().endsWith('.pdf')
        ? 'PDF tabloları güvenilir biçimde okunamıyor. Listeyi Excel\'e aktarıp (.xlsx) ya da şablona yapıştırıp yükleyin.'
        : (e as Error).message)
    } finally { setBusy(false) }
  }

  const plan = useMemo(() => (file && map.name !== undefined ? planImport(repos, file.rows, map, { costIncludesVat: incl.cost, priceIncludesVat: incl.price, defaultVat }) : null), [file, map, incl, defaultVat, repos])
  const created = plan?.items.filter((i) => i.status === 'new').length ?? 0
  const updated = (plan?.items.length ?? 0) - created
  const header = file?.rows[0] ?? []

  const run = () => {
    if (!plan) return
    const r = importProducts(repos, plan.items)
    toast(`${r.created} ürün eklendi${r.updated ? `, ${r.updated} ürün güncellendi` : ''}`)
    onClose()
  }

  return (
    <Modal wide title="Excel'den ürün aktar" onClose={onClose} footer={file
      ? <><Button variant="ghost" onClick={() => { setFile(null); setError('') }}>Başka dosya</Button><Button variant="primary" icon={Upload} disabled={!plan?.items.length} onClick={run}>{plan?.items.length ?? 0} ürünü aktar</Button></>
      : <Button variant="ghost" onClick={onClose}>Vazgeç</Button>}>
      <div className="import-wrap">
        {!file && (
          <>
            <button
              className={cx('drop-zone', drag && 'on')}
              onClick={() => input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) load(f) }}
            >
              <FileSpreadsheet />
              <b>{busy ? 'Okunuyor…' : 'Excel ya da CSV dosyasını sürükleyin veya seçin'}</b>
              <span>.xlsx · .csv — ilk satır başlık olmalı (Ürün Adı, Marka, Kategori, Alış/Satış Fiyatı, KDV, Stok…)</span>
            </button>
            <input ref={input} type="file" hidden accept=".xlsx,.csv,.txt,.xls,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = '' }} />
            {error && <div className="conflict-box"><AlertTriangle /> <span>{error}</span></div>}
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span className="t-small muted">Elinizdeki listenin sütun adları farklıysa sorun değil; bir sonraki adımda eşleştirirsiniz.</span>
              <Button size="sm" icon={Download} onClick={downloadTemplate}>Örnek şablon</Button>
            </div>
          </>
        )}

        {file && (
          <>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <FileSpreadsheet style={{ width: 18, color: 'var(--success)' }} />
              <b>{file.name}</b><span className="muted t-small">{file.rows.length - 1} satır</span>
              <span className="spacer" />
              {created > 0 && <Badge tone="success">{created} yeni</Badge>}
              {updated > 0 && <Badge tone="info">{updated} güncellenecek</Badge>}
              {!!plan?.errors.length && <Badge tone="danger">{plan.errors.length} atlanacak</Badge>}
            </div>

            <div>
              <div className="t-small muted" style={{ marginBottom: 6 }}>Sütun eşleştirme</div>
              <div className="map-grid">
                {FIELDS.map((f) => (
                  <label key={f} className={cx('map-cell', f === 'name' && map.name === undefined && 'bad')}>
                    <span>{FIELD_LABEL[f]}{f === 'name' && ' *'}</span>
                    <Select value={map[f] ?? ''} onChange={(e) => setMap({ ...map, [f]: e.target.value === '' ? undefined : Number(e.target.value) })}>
                      <option value="">—</option>
                      {header.map((h, i) => <option key={i} value={i}>{h || `Sütun ${i + 1}`}</option>)}
                    </Select>
                  </label>
                ))}
              </div>
            </div>

            <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
              {map.cost !== undefined && <div className="row" style={{ gap: 8 }}><Switch on={incl.cost} onChange={(v) => setIncl({ ...incl, cost: v })} /><span className="t-small">Alış fiyatları <b>KDV dahil</b></span></div>}
              {map.price !== undefined && <div className="row" style={{ gap: 8 }}><Switch on={incl.price} onChange={(v) => setIncl({ ...incl, price: v })} /><span className="t-small">Satış fiyatları <b>KDV dahil</b></span></div>}
              <div className="row" style={{ gap: 8 }}>
                <span className="t-small muted">KDV sütunu yoksa</span>
                <div className="seg">{VAT_RATES.map((r) => <button key={r} className={defaultVat === r ? 'on' : ''} onClick={() => setDefaultVat(r)}>%{r}</button>)}</div>
              </div>
            </div>

            {map.name === undefined && <div className="conflict-box"><AlertTriangle /> <span>"Ürün adı" sütununu seçin.</span></div>}

            {plan && plan.items.length > 0 && (
              <div className="table-wrap import-table">
                <table className="table">
                  <thead><tr><th>Satır</th><th>Ürün</th><th>Marka</th><th>Kategori</th><th className="r">Alış</th><th className="r">Satış (KDV dahil)</th><th className="r">Stok</th><th>Durum</th></tr></thead>
                  <tbody>
                    {plan.items.slice(0, 100).map((it) => {
                      const p = it.product
                      const cur = it.existingId ? repos.products.get(it.existingId) : undefined
                      const vat = p.vatRate ?? cur?.vatRate ?? defaultVat
                      return (
                        <tr key={it.row}>
                          <td className="muted num">{it.row}</td>
                          <td className="t-strong">{p.name}{p.kind === 'professional' && <span className="muted t-small"> · salon</span>}</td>
                          <td>{p.brand ?? cur?.brand}</td>
                          <td>{p.category ?? cur?.category}</td>
                          <td className="r num">{p.cost != null ? formatTRY(p.cost) : '—'}</td>
                          <td className="r num">{p.price ? formatTRY(withVat(p.price, vat)) : '—'}</td>
                          <td className="r num">{it.stock ?? '—'}</td>
                          <td>{it.status === 'new' ? <Badge tone="success">Yeni</Badge> : <Badge tone="info">Güncelle</Badge>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {plan.items.length > 100 && <p className="t-small muted" style={{ padding: 10 }}>… ve {plan.items.length - 100} ürün daha</p>}
              </div>
            )}

            {!!plan?.errors.length && (
              <div className="import-errors">
                <b className="t-small">Atlanacak satırlar</b>
                {plan.errors.slice(0, 20).map((e) => <div key={e.row} className="t-small"><span className="muted">Satır {e.row}:</span> {e.message}</div>)}
                {plan.errors.length > 20 && <div className="t-small muted">… {plan.errors.length - 20} satır daha</div>}
              </div>
            )}
            <p className="t-small muted">Mevcut ürünler barkoddan, yoksa ad + markadan tanınır ve güncellenir; listedeki stok sayım olarak işlenir. Yeni ürünlerin stoğu "Excel içe aktarma" girişi olarak kaydedilir.</p>
          </>
        )}
      </div>
    </Modal>
  )
}
