import { Gift, Minus, Package, Percent, Plus, Receipt, Scissors, Search, ShoppingBag, Trash2, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { priceFor } from '../../application/appointmentService'
import { cashService, CASH_ERROR_TEXT } from '../../application/cashService'
import { trLower } from '../../application/customerService'
import { useSession } from '../../app/session'
import { applyDiscount, formatTRY, parseTRY } from '../../domain/money'
import { lineTotal, ticketTotals } from '../../domain/ticket'
import { formatDate, todayIstanbul } from '../../domain/time'
import type { Customer, Ticket, TicketLine } from '../../domain/types'
import { useRepos } from '../../infrastructure'
import { Badge, Button, cx, Field, IconButton, Input, Segmented, Select, useConfirm, useToast } from '../../ui'
import { CustomerPicker } from '../calendar/AppointmentForm'
import { PaymentModal } from './PaymentModal'

type AddTab = 'service' | 'product' | 'package_sale' | 'package_use'

export function TicketEditor({ ticket, onClosed, onDeleted }: { ticket: Ticket; onClosed: (t: Ticket) => void; onDeleted: () => void }) {
  const repos = useRepos()
  const { user, branch } = useSession()
  const toast = useToast()
  const confirm = useConfirm()
  const cash = cashService(repos, user)
  const [tab, setTab] = useState<AddTab>('service')
  const [q, setQ] = useState('')
  const [paying, setPaying] = useState(false)
  const staff = repos.staff.list({ branchId: branch?.id ?? ticket.branchId, active: true })
  const defaultStaff = ticket.lines.find((l) => l.staffId)?.staffId ?? staff[0]?.id
  const [lineStaff, setLineStaff] = useState(defaultStaff ?? '')
  const tt = ticketTotals(ticket)
  const closed = ticket.status === 'closed'
  const customer = ticket.customerId ? repos.customers.get(ticket.customerId) ?? null : null
  const locked = cash.isLocked(ticket.branchId, ticket.date)

  const catalog = useMemo(() => {
    const term = trLower(q.trim())
    const match = (s: string) => !term || trLower(s).includes(term)
    const lineStaffObj = repos.staff.get(lineStaff)
    if (tab === 'service') return repos.services.list().filter((s) => match(s.name)).map((s) => ({ key: s.id, title: s.name, sub: `${s.duration} dk`, price: priceFor(s, lineStaff), disabled: lineStaffObj ? !lineStaffObj.serviceIds.includes(s.id) : false, add: () => ({ kind: 'service' as const, refId: s.id, name: s.name, staffId: lineStaff, qty: 1, unitPrice: priceFor(s, lineStaff), discount: null }) }))
    if (tab === 'product') return repos.products.list({ kind: 'retail' }).filter((p) => match(p.name) || match(p.brand)).map((p) => ({ key: p.id, title: p.name, sub: `${p.brand} · stok ${p.stock}`, price: p.price, disabled: p.stock <= 0, add: () => ({ kind: 'product' as const, refId: p.id, name: p.name, staffId: lineStaff, qty: 1, unitPrice: p.price, discount: null }) }))
    if (tab === 'package_sale') return repos.packageDefs.list({ active: true }).filter((p) => match(p.name)).map((p) => ({ key: p.id, title: p.name, sub: `${p.validDays} gün geçerli`, price: p.price, disabled: false, add: () => ({ kind: 'package_sale' as const, refId: p.id, name: p.name, qty: 1, unitPrice: p.price, discount: null }) }))
    if (!ticket.customerId) return []
    const today = todayIstanbul()
    return repos.customerPackages.list({ customerId: ticket.customerId }).filter((cp) => cp.expiresOn >= today).flatMap((cp) =>
      Object.entries(cp.remaining).map(([sid, n]) => {
        const svc = repos.services.get(sid)
        const def = repos.packageDefs.get(cp.packageDefId)
        return { key: cp.id + sid, title: `${svc?.name ?? 'Hizmet'} (paket)`, sub: `${def?.name} · ${n} seans kaldı`, price: 0, disabled: n <= 0, add: () => ({ kind: 'package_use' as const, refId: cp.id, serviceId: sid, name: `${svc?.name ?? 'Hizmet'} (paket)`, staffId: lineStaff, qty: 1, unitPrice: 0, discount: null }) }
      }),
    )
  }, [tab, q, repos, lineStaff, ticket.customerId])

  const add = (line: Omit<TicketLine, 'id'>) => {
    if (line.kind === 'package_sale' && !ticket.customerId) { toast('Paket satışı için önce müşteri seçin', 'error'); return }
    cash.addLine(ticket.id, line)
  }

  const [discountType, setDiscountType] = useState<'percent' | 'amount'>(ticket.discount?.type ?? 'percent')

  return (
    <div className="ticket">
      <div className="ticket-head">
        <div>
          <h2>{customer?.name ?? 'Müşterisiz adisyon'}</h2>
          <p className="muted t-small">{formatDate(ticket.date, { weekday: true })} · #{ticket.id.slice(-5).toUpperCase()}{ticket.appointmentId && ' · randevudan'}</p>
        </div>
        {closed ? <Badge tone="success" dot>Kapandı</Badge> : <Badge tone="warning" dot>Açık</Badge>}
      </div>

      {!closed && (
        <Field label="Müşteri">
          <CustomerPicker value={customer} onChange={(c: Customer | null) => cash.setCustomer(ticket.id, c?.id ?? null)} />
        </Field>
      )}

      <div className="ticket-lines">
        {ticket.lines.length === 0 && <p className="muted t-small" style={{ padding: 16, textAlign: 'center' }}>Aşağıdan hizmet veya ürün ekleyin.</p>}
        {ticket.lines.map((l) => (
          <div key={l.id} className="tl">
            <span className={cx('tl-kind', l.kind)}>
              {l.kind === 'service' ? <Scissors /> : l.kind === 'product' ? <ShoppingBag /> : l.kind === 'package_sale' ? <Gift /> : <Package />}
            </span>
            <div className="tl-main">
              <b>{l.name}</b>
              <span className="t-small muted">
                {l.staffId ? repos.staff.get(l.staffId)?.name : l.kind === 'package_sale' ? 'Paket satışı' : ''}
                {l.discount && <> · <Badge tone="accent">-{l.discount.type === 'percent' ? `%${l.discount.value}` : formatTRY(l.discount.value)}</Badge></>}
              </span>
            </div>
            {!closed && l.kind !== 'package_use' && (
              <div className="qty">
                <button onClick={() => (l.qty > 1 ? cash.updateLine(ticket.id, l.id, { qty: l.qty - 1 }) : cash.removeLine(ticket.id, l.id))} aria-label="Azalt"><Minus /></button>
                <span>{l.qty}</span>
                <button onClick={() => cash.updateLine(ticket.id, l.id, { qty: l.qty + 1 })} aria-label="Artır"><Plus /></button>
              </div>
            )}
            {!closed && l.kind !== 'package_use' ? (
              <input
                className="tl-price"
                defaultValue={String(l.unitPrice / 100).replace('.', ',')}
                key={l.unitPrice}
                inputMode="decimal"
                aria-label="Birim fiyat"
                onBlur={(e) => { const v = parseTRY(e.target.value); if (v >= 0 && v !== l.unitPrice) cash.updateLine(ticket.id, l.id, { unitPrice: v }) }}
              />
            ) : null}
            <b className="tl-total num">{formatTRY(lineTotal(l))}</b>
            {!closed && <IconButton icon={Trash2} label="Satırı sil" onClick={() => cash.removeLine(ticket.id, l.id)} />}
          </div>
        ))}
      </div>

      {!closed && (
        <div className="add-box">
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <Segmented
              value={tab}
              onChange={(v) => { setTab(v); setQ('') }}
              options={[
                { value: 'service', label: 'Hizmet', icon: Scissors },
                { value: 'product', label: 'Ürün', icon: ShoppingBag },
                { value: 'package_sale', label: 'Paket sat', icon: Gift },
                { value: 'package_use', label: 'Paketten', icon: Package },
              ]}
            />
            <div className="spacer" />
            {tab !== 'package_sale' && (
              <Select value={lineStaff} onChange={(e) => setLineStaff(e.target.value)} style={{ width: 150, height: 36 }} aria-label="Personel">
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}
          </div>
          <Input icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara…" />
          <div className="catalog">
            {catalog.length === 0 && <p className="muted t-small">{tab === 'package_use' ? (ticket.customerId ? 'Müşterinin aktif paketi yok.' : 'Önce müşteri seçin.') : 'Sonuç yok.'}</p>}
            {catalog.map((c) => (
              <button key={c.key} className="cat-item" disabled={c.disabled} onClick={() => add(c.add())}>
                <b>{c.title}</b>
                <span>{c.sub}</span>
                <em>{c.price ? formatTRY(c.price) : 'Ücretsiz'}</em>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ticket-sum">
        <div className="sum-row"><span className="muted">Ara toplam</span><span>{formatTRY(tt.subtotal)}</span></div>
        {!closed ? (
          <div className="sum-row" style={{ alignItems: 'center' }}>
            <span className="muted row" style={{ gap: 6 }}><Percent size={14} /> İndirim</span>
            <div className="row" style={{ gap: 6 }}>
              <div className="seg seg-sm">
                <button className={discountType === 'percent' ? 'on' : ''} onClick={() => { setDiscountType('percent'); cash.setDiscount(ticket.id, null) }}>%</button>
                <button className={discountType === 'amount' ? 'on' : ''} onClick={() => { setDiscountType('amount'); cash.setDiscount(ticket.id, null) }}>₺</button>
              </div>
              <input
                className="tl-price"
                key={`${discountType}-${ticket.discount?.value}`}
                defaultValue={ticket.discount ? (discountType === 'percent' ? ticket.discount.value : ticket.discount.value / 100) : ''}
                placeholder="0"
                inputMode="decimal"
                onBlur={(e) => {
                  const raw = e.target.value.trim()
                  if (!raw) return cash.setDiscount(ticket.id, null)
                  const value = discountType === 'percent' ? Math.min(100, Number(raw.replace(',', '.')) || 0) : parseTRY(raw)
                  cash.setDiscount(ticket.id, value ? { type: discountType, value } : null)
                }}
              />
              <span className="num" style={{ minWidth: 70, textAlign: 'right', color: 'var(--danger)' }}>{tt.discount ? `-${formatTRY(tt.discount)}` : ''}</span>
            </div>
          </div>
        ) : tt.discount > 0 && <div className="sum-row"><span className="muted">İndirim</span><span style={{ color: 'var(--danger)' }}>-{formatTRY(tt.discount)}</span></div>}
        {!closed ? (
          <div className="sum-row" style={{ alignItems: 'center' }}>
            <span className="muted">Bahşiş</span>
            <div className="row" style={{ gap: 6 }}>
              <Select value={ticket.tipStaffId ?? defaultStaff ?? ''} onChange={(e) => cash.setTip(ticket.id, ticket.tip, e.target.value)} style={{ width: 120, height: 32 }}>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name.split(' ')[0]}</option>)}
              </Select>
              <input className="tl-price" key={ticket.tip} defaultValue={ticket.tip ? ticket.tip / 100 : ''} placeholder="0" inputMode="decimal" onBlur={(e) => cash.setTip(ticket.id, parseTRY(e.target.value), ticket.tipStaffId ?? defaultStaff)} />
            </div>
          </div>
        ) : ticket.tip > 0 && <div className="sum-row"><span className="muted">Bahşiş</span><span>{formatTRY(ticket.tip)}</span></div>}
        <div className="sum-row total"><span>Toplam</span><span className="num">{formatTRY(tt.total)}</span></div>
        {ticket.payments.length > 0 && (
          <div className="pay-chips">
            {ticket.payments.map((p, i) => <Badge key={i} tone={p.method === 'debt' ? 'danger' : 'success'}>{({ cash: 'Nakit', card: 'Kart', transfer: 'Havale', debt: 'Veresiye' })[p.method]} {formatTRY(p.amount)}</Badge>)}
          </div>
        )}
      </div>

      {!closed && (
        <div className="ticket-actions">
          <Button
            variant="ghost"
            icon={Trash2}
            onClick={async () => {
              if (await confirm({ title: 'Adisyon silinsin mi?', text: 'Eklenen tüm satırlar silinir.', danger: true, confirm: 'Sil' })) {
                cash.cancelTicket(ticket.id)
                onDeleted()
              }
            }}
          >
            Sil
          </Button>
          <div className="spacer" />
          {locked && <span className="t-small" style={{ color: 'var(--danger)' }}>Gün kapalı</span>}
          <Button variant="primary" size="lg" icon={tt.total === 0 ? Receipt : Wallet} disabled={!ticket.lines.length || locked} onClick={() => {
            if (tt.total === 0) {
              const r = cash.pay(ticket.id, [])
              if (r.ok) { toast('Adisyon kapandı'); onClosed(r.ticket) } else toast(CASH_ERROR_TEXT[r.error], 'error')
            } else setPaying(true)
          }}>
            {tt.total === 0 ? 'Kapat' : `Ödeme al · ${formatTRY(tt.total - tt.paid - tt.debt > 0 ? tt.total - tt.paid - tt.debt : tt.total)}`}
          </Button>
        </div>
      )}

      {paying && (
        <PaymentModal
          ticket={ticket}
          hasCustomer={!!ticket.customerId}
          onClose={() => setPaying(false)}
          onPay={(payments) => {
            const r = cash.pay(ticket.id, payments)
            if (!r.ok) { toast(CASH_ERROR_TEXT[r.error], 'error'); return }
            setPaying(false)
            if (r.ticket.status === 'closed') { toast(`Ödeme alındı · ${formatTRY(applyDiscount(tt.total, null))}`); onClosed(r.ticket) } else toast('Kısmi ödeme kaydedildi', 'info')
          }}
        />
      )}
    </div>
  )
}
