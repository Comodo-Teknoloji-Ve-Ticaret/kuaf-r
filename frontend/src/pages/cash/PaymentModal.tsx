import { Banknote, CreditCard, Landmark, NotebookPen, Plus, X, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { METHOD_LABEL } from '../../application/cashService'
import { useSession } from '../../app/session'
import { formatTRY, parseTRY } from '../../domain/money'
import { ticketTotals } from '../../domain/ticket'
import type { Payment, PaymentMethod, Ticket } from '../../domain/types'
import { Button, cx, IconButton, Modal } from '../../ui'

const ICON: Record<PaymentMethod, LucideIcon> = { cash: Banknote, card: CreditCard, transfer: Landmark, debt: NotebookPen }
const fmtInput = (k: number) => (k ? String(k / 100).replace('.', ',') : '')

type Row = { method: PaymentMethod; amount: string; accountId?: string }

export function PaymentModal({ ticket, hasCustomer, onClose, onPay }: { ticket: Ticket; hasCustomer: boolean; onClose: () => void; onPay: (p: Payment[]) => void }) {
  const { tenant } = useSession()
  const accounts = (tenant?.accounts ?? []).filter((a) => a.active)
  const pos = accounts.filter((a) => a.kind === 'pos')
  const banks = accounts.filter((a) => a.kind === 'bank')
  const defaultAcc = (m: PaymentMethod) => (m === 'card' ? pos[0]?.id : m === 'transfer' ? banks[0]?.id : undefined)
  const total = ticketTotals(ticket).total
  const [rows, setRows] = useState<Row[]>(() =>
    ticket.payments.length ? ticket.payments.map((p) => ({ method: p.method, amount: fmtInput(p.amount), accountId: p.accountId })) : [{ method: 'cash', amount: fmtInput(total) }],
  )
  const [given, setGiven] = useState('')
  const paid = rows.reduce((s, r) => s + parseTRY(r.amount), 0)
  const remaining = total - paid
  const cashPart = rows.filter((r) => r.method === 'cash').reduce((s, r) => s + parseTRY(r.amount), 0)
  const change = given ? parseTRY(given) - cashPart : 0
  const missingAccount = rows.some((r) => (r.method === 'card' && pos.length > 0 || r.method === 'transfer' && banks.length > 0) && !r.accountId)

  const quick: { key: string; method: PaymentMethod; accountId?: string; label: string; sub?: string }[] = [
    { key: 'cash', method: 'cash', label: 'Nakit' },
    ...(pos.length ? pos.map((a) => ({ key: a.id, method: 'card' as const, accountId: a.id, label: 'Kart', sub: a.name })) : [{ key: 'card', method: 'card' as const, label: 'Kart' }]),
    ...(banks.length ? banks.map((a) => ({ key: a.id, method: 'transfer' as const, accountId: a.id, label: 'Havale', sub: a.name })) : [{ key: 'transfer', method: 'transfer' as const, label: 'Havale' }]),
    { key: 'debt', method: 'debt', label: 'Veresiye' },
  ]
  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  return (
    <Modal
      title="Ödeme al"
      onClose={onClose}
      wide
      footer={
        <>
          {missingAccount && <span className="t-small" style={{ color: 'var(--warning)', marginRight: 'auto' }}>Kart / havale için POS veya hesap seçin</span>}
          <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
          <Button
            variant="primary"
            size="lg"
            disabled={remaining < 0 || paid === 0 || missingAccount}
            onClick={() => onPay(rows.map((r) => ({ method: r.method, amount: parseTRY(r.amount), ...(r.accountId && (r.method === 'card' || r.method === 'transfer') ? { accountId: r.accountId } : {}) })).filter((p) => p.amount > 0))}
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
        {quick.map((q) => {
          const Icon = ICON[q.method]
          const on = rows.length === 1 && rows[0].method === q.method && (rows[0].accountId ?? undefined) === q.accountId
          return (
            <button key={q.key} className={cx('pay-q', on && 'on')} disabled={q.method === 'debt' && !hasCustomer} title={q.method === 'debt' && !hasCustomer ? 'Veresiye için müşteri seçin' : ''} onClick={() => setRows([{ method: q.method, amount: fmtInput(total), accountId: q.accountId }])}>
              <Icon />
              <span>{q.label}</span>
              {q.sub && <small>{q.sub}</small>}
            </button>
          )
        })}
      </div>

      <div className="pay-rows">
        {rows.map((r, i) => {
          const accs = r.method === 'card' ? pos : r.method === 'transfer' ? banks : []
          return (
            <div key={i} className="pay-row">
              <select className="select" value={r.method} onChange={(e) => { const m = e.target.value as PaymentMethod; setRow(i, { method: m, accountId: defaultAcc(m) }) }}>
                {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => <option key={m} value={m} disabled={m === 'debt' && !hasCustomer}>{METHOD_LABEL[m]}</option>)}
              </select>
              {accs.length > 0 && (
                <select className="select" value={r.accountId ?? ''} onChange={(e) => setRow(i, { accountId: e.target.value || undefined })}>
                  <option value="">{r.method === 'card' ? 'POS seçin…' : 'Hesap seçin…'}</option>
                  {accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              <div className="pay-amount">
                <span>₺</span>
                <input inputMode="decimal" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
              </div>
              {rows.length > 1 && <IconButton icon={X} label="Kaldır" onClick={() => setRows(rows.filter((_, j) => j !== i))} />}
            </div>
          )
        })}
        <Button size="sm" variant="ghost" icon={Plus} onClick={() => { const m: PaymentMethod = rows.some((r) => r.method === 'card') ? 'cash' : 'card'; setRows([...rows, { method: m, amount: fmtInput(Math.max(0, remaining)), accountId: defaultAcc(m) }]) }}>
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
