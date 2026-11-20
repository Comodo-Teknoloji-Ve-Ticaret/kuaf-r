import { Banknote, CreditCard, Landmark, NotebookPen, Plus, X, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { METHOD_LABEL } from '../../application/cashService'
import { formatTRY, parseTRY } from '../../domain/money'
import { ticketTotals } from '../../domain/ticket'
import type { Payment, PaymentMethod, Ticket } from '../../domain/types'
import { Button, cx, IconButton, Modal } from '../../ui'

const METHODS: { m: PaymentMethod; icon: LucideIcon }[] = [
  { m: 'cash', icon: Banknote },
  { m: 'card', icon: CreditCard },
  { m: 'transfer', icon: Landmark },
  { m: 'debt', icon: NotebookPen },
]

const fmtInput = (k: number) => (k ? String(k / 100).replace('.', ',') : '')

export function PaymentModal({ ticket, hasCustomer, onClose, onPay }: { ticket: Ticket; hasCustomer: boolean; onClose: () => void; onPay: (p: Payment[]) => void }) {
  const total = ticketTotals(ticket).total
  const [rows, setRows] = useState<{ method: PaymentMethod; amount: string }[]>(() =>
    ticket.payments.length ? ticket.payments.map((p) => ({ method: p.method, amount: fmtInput(p.amount) })) : [{ method: 'cash', amount: fmtInput(total) }],
  )
  const [given, setGiven] = useState('')
  const paid = rows.reduce((s, r) => s + parseTRY(r.amount), 0)
  const remaining = total - paid
  const cashPart = rows.filter((r) => r.method === 'cash').reduce((s, r) => s + parseTRY(r.amount), 0)
  const change = given ? parseTRY(given) - cashPart : 0

  const quick = (m: PaymentMethod) => setRows([{ method: m, amount: fmtInput(total) }])

  return (
    <Modal
      title="Ödeme al"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
          <Button
            variant="primary"
            size="lg"
            disabled={remaining < 0 || paid === 0}
            onClick={() => onPay(rows.map((r) => ({ method: r.method, amount: parseTRY(r.amount) })).filter((p) => p.amount > 0))}
          >
            {remaining > 0 ? `Kısmi kaydet (${formatTRY(paid)})` : 'Ödemeyi tamamla'}
          </Button>
        </>
      }
    >
      <div className="pay-total">
        <span>Tahsil edilecek</span>
        <b className="num">{formatTRY(total)}</b>
      </div>

      <div className="pay-quick">
        {METHODS.map(({ m, icon: Icon }) => (
          <button key={m} className={cx('pay-q', rows.length === 1 && rows[0].method === m && 'on')} disabled={m === 'debt' && !hasCustomer} onClick={() => quick(m)} title={m === 'debt' && !hasCustomer ? 'Veresiye için müşteri seçin' : ''}>
            <Icon />
            <span>{METHOD_LABEL[m]}</span>
          </button>
        ))}
      </div>

      <div className="pay-rows">
        {rows.map((r, i) => (
          <div key={i} className="pay-row">
            <select className="select" value={r.method} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, method: e.target.value as PaymentMethod } : x)))}>
              {METHODS.map(({ m }) => <option key={m} value={m} disabled={m === 'debt' && !hasCustomer}>{METHOD_LABEL[m]}</option>)}
            </select>
            <div className="pay-amount">
              <span>₺</span>
              <input inputMode="decimal" value={r.amount} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
            </div>
            {rows.length > 1 && <IconButton icon={X} label="Kaldır" onClick={() => setRows(rows.filter((_, j) => j !== i))} />}
          </div>
        ))}
        <Button size="sm" variant="ghost" icon={Plus} onClick={() => setRows([...rows, { method: rows.some((r) => r.method === 'card') ? 'cash' : 'card', amount: fmtInput(Math.max(0, remaining)) }])}>
          Ödemeyi böl
        </Button>
      </div>

      <div className={cx('pay-status', remaining === 0 ? 'ok' : remaining < 0 ? 'over' : 'left')}>
        {remaining === 0 ? 'Tutar tamam' : remaining > 0 ? `Kalan: ${formatTRY(remaining)}` : `Fazla: ${formatTRY(-remaining)}`}
      </div>

      {cashPart > 0 && (
        <div className="change-box">
          <label>Müşteriden alınan nakit</label>
          <div className="pay-amount"><span>₺</span><input inputMode="decimal" value={given} onChange={(e) => setGiven(e.target.value)} placeholder={fmtInput(cashPart)} /></div>
          {change > 0 && <b>Para üstü: {formatTRY(change)}</b>}
        </div>
      )}
    </Modal>
  )
}
