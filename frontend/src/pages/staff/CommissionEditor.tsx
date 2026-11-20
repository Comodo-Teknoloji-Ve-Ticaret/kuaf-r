import { ChevronDown, ChevronRight, Layers, Plus, Tags, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../../app/session'
import { tieredCommission } from '../../domain/commission'
import { formatTRY, parseTRY } from '../../domain/money'
import type { Staff } from '../../domain/types'
import { useRepos } from '../../infrastructure'
import { Button, cx, Field, IconButton, Input, Segmented, useToast } from '../../ui'

type Form = Omit<Staff, 'id' | 'tenantId'>

/** Boş bırakılan oran "varsayılan"a düşer. */
function Pct({ value, placeholder, onChange, label }: { value: number | undefined; placeholder: number; onChange: (v: number | undefined) => void; label: string }) {
  return (
    <label className="pct" aria-label={label}>
      <span>%</span>
      <input inputMode="decimal" value={value ?? ''} placeholder={String(placeholder)} onChange={(e) => {
        const raw = e.target.value.replace(',', '.').trim()
        if (!raw) return onChange(undefined)
        const n = Number(raw)
        if (Number.isFinite(n)) onChange(Math.max(0, Math.min(100, n)))
      }} />
    </label>
  )
}

const setKey = <T,>(obj: Record<string, T>, k: string, v: T | undefined) => {
  const out = { ...obj }
  if (v === undefined) delete out[k]
  else out[k] = v
  return out
}

export function CommissionEditor({ f, setF }: { f: Form; setF: (f: Form) => void }) {
  const repos = useRepos()
  const { tenant } = useSession()
  const toast = useToast()
  const [open, setOpen] = useState<string | null>(null)
  const [newBrand, setNewBrand] = useState('')
  const cats = repos.categories.list().sort((a, b) => a.order - b.order)
  const services = repos.services.list()
  const brands = [...(tenant?.brands ?? [])].sort((a, b) => a.localeCompare(b, 'tr'))
  const tiers = [...f.tiers].sort((a, b) => a.from - b.from)
  const example = 8_000_000

  const addBrand = () => {
    const b = newBrand.trim()
    if (!b || !tenant) return
    if (!brands.some((x) => x.toLocaleLowerCase('tr') === b.toLocaleLowerCase('tr'))) repos.tenants.upsert({ ...tenant, brands: [...tenant.brands, b] })
    setNewBrand('')
    toast(`${b} markası eklendi`)
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <section className="cm-sec">
        <h4><Layers size={16} /> Hizmet primi</h4>
        <Segmented
          value={f.commissionMode}
          onChange={(v) => setF({ ...f, commissionMode: v })}
          options={[{ value: 'category', label: 'Kategoriye göre %' }, { value: 'tiered', label: 'Kademeli (aylık ciroya göre)' }]}
        />

        {f.commissionMode === 'category' ? (
          <>
            <div className="cm-row cm-default">
              <span>Varsayılan (tanımlanmayanlar)</span>
              <Pct label="Varsayılan hizmet primi" value={f.serviceCommission} placeholder={0} onChange={(v) => setF({ ...f, serviceCommission: v ?? 0 })} />
            </div>
            <div className="cm-list">
              {cats.map((c) => {
                const list = services.filter((s) => s.categoryId === c.id)
                const overrides = list.filter((s) => f.serviceRates[s.id] !== undefined).length
                const isOpen = open === c.id
                return (
                  <div key={c.id} className="cm-cat">
                    <div className="cm-row">
                      <button className="cm-toggle" onClick={() => setOpen(isOpen ? null : c.id)}>
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        <i style={{ background: `var(--cat-${c.color}-bd)` }} />
                        {c.name}
                        {overrides > 0 && <span className="cm-badge">{overrides} hizmete özel</span>}
                      </button>
                      <Pct label={`${c.name} primi`} value={f.categoryRates[c.id]} placeholder={f.serviceCommission} onChange={(v) => setF({ ...f, categoryRates: setKey(f.categoryRates, c.id, v) })} />
                    </div>
                    {isOpen && (
                      <div className="cm-sub">
                        {list.map((s) => (
                          <div key={s.id} className="cm-row">
                            <span className="muted">{s.name}</span>
                            <Pct label={`${s.name} primi`} value={f.serviceRates[s.id]} placeholder={f.categoryRates[c.id] ?? f.serviceCommission} onChange={(v) => setF({ ...f, serviceRates: setKey(f.serviceRates, s.id, v) })} />
                          </div>
                        ))}
                        <p className="t-small muted">Boş bırakılan hizmetler kategori oranını kullanır.</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <p className="t-small muted">Prim, personelin o ay yaptığı hizmet cirosunun yalnızca ilgili dilime düşen kısmına uygulanır.</p>
            <div className="cm-list">
              {tiers.map((t, i) => {
                const next = tiers[i + 1]
                return (
                  <div key={i} className="cm-row">
                    <span className="cm-tier">
                      <span className="tier-money">
                        ₺
                        <input
                          inputMode="decimal"
                          disabled={i === 0}
                          defaultValue={String(t.from / 100)}
                          key={`${i}-${t.from}`}
                          onBlur={(e) => {
                            const v = parseTRY(e.target.value)
                            setF({ ...f, tiers: tiers.map((x, j) => (j === i ? { ...x, from: v } : x)) })
                          }}
                        />
                      </span>
                      <span className="muted">{next ? `– ${formatTRY(next.from)} arası` : 've üzeri'}</span>
                    </span>
                    <Pct label="Dilim oranı" value={t.rate} placeholder={0} onChange={(v) => setF({ ...f, tiers: tiers.map((x, j) => (j === i ? { ...x, rate: v ?? 0 } : x)) })} />
                    {i > 0 ? <IconButton icon={Trash2} label="Dilimi sil" onClick={() => setF({ ...f, tiers: tiers.filter((_, j) => j !== i) })} /> : <span style={{ width: 36 }} />}
                  </div>
                )
              })}
            </div>
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => setF({ ...f, tiers: [...tiers, { from: (tiers[tiers.length - 1]?.from ?? 0) + 5_000_000, rate: (tiers[tiers.length - 1]?.rate ?? 0) + 5 }] })}>Dilim ekle</Button>
            <div className="cm-example">
              Örnek: ayda <b>{formatTRY(example)}</b> hizmet → prim <b>{formatTRY(tieredCommission(example, tiers))}</b>
            </div>
          </>
        )}
      </section>

      <section className="cm-sec">
        <h4><Tags size={16} /> Ürün satış primi (markaya göre)</h4>
        <div className="cm-row cm-default">
          <span>Varsayılan (tanımlanmayan markalar)</span>
          <Pct label="Varsayılan ürün primi" value={f.productCommission} placeholder={0} onChange={(v) => setF({ ...f, productCommission: v ?? 0 })} />
        </div>
        <div className="cm-list">
          {brands.length === 0 && <p className="t-small muted" style={{ padding: 10 }}>Henüz marka yok. Aşağıdan ekleyin ya da stokta ürün eklerken tanımlayın.</p>}
          {brands.map((b) => (
            <div key={b} className={cx('cm-row', f.brandRates[b] !== undefined && 'set')}>
              <span>{b}</span>
              <Pct label={`${b} primi`} value={f.brandRates[b]} placeholder={f.productCommission} onChange={(v) => setF({ ...f, brandRates: setKey(f.brandRates, b, v) })} />
            </div>
          ))}
        </div>
        <Field label="Marka ekle">
          <div className="row">
            <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Örn. Wella" onKeyDown={(e) => e.key === 'Enter' && addBrand()} />
            <Button icon={Plus} onClick={addBrand} disabled={!newBrand.trim()}>Ekle</Button>
          </div>
        </Field>
      </section>
    </div>
  )
}
