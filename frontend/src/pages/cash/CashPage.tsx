import { ArrowLeft, Banknote, CreditCard, Download, Landmark, Lock, LockOpen, NotebookPen, Plus, Receipt, TrendingDown, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { appointmentService } from '../../application/appointmentService'
import { cashService, CASH_ERROR_TEXT, METHOD_LABEL } from '../../application/cashService'
import { customerService } from '../../application/customerService'
import { toCSV } from '../../application/reportService'
import { useSession } from '../../app/session'
import { formatTRY, parseTRY } from '../../domain/money'
import { formatPhone } from '../../domain/phone'
import { ticketTotals } from '../../domain/ticket'
import { addDays, formatDate, todayIstanbul, toHHMM } from '../../domain/time'
import type { PaymentMethod } from '../../domain/types'
import { useRepos } from '../../infrastructure'
import { Avatar, Badge, Button, cx, EmptyState, Field, Input, Kpi, Modal, PageHeader, Select, Tabs, Textarea, useConfirm, useIsMobile, useToast } from '../../ui'
import { TicketEditor } from './TicketEditor'
import './cash.css'

type Tab = 'tickets' | 'day' | 'expenses' | 'debts'

export default function CashPage() {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('tickets')
  const repos = useRepos()
  const { branch } = useSession()
  const today = todayIstanbul()
  const open = repos.tickets.list({ status: 'open' }).filter((t) => t.branchId === branch?.id)
  const debtors = repos.customers.list().filter((c) => customerService(repos).balance(c.id) > 0).length
  useEffect(() => { if (params.get('adisyon')) setTab('tickets') }, [params])

  return (
    <div className="page">
      <PageHeader title="Kasa" subtitle={`${branch?.name} · ${formatDate(today, { weekday: true })}`} />
      <Tabs
        value={tab}
        onChange={(v) => { setTab(v); setParams({}) }}
        options={[
          { value: 'tickets', label: 'Adisyonlar', count: open.length },
          { value: 'day', label: 'Gün sonu' },
          { value: 'expenses', label: 'Giderler' },
          { value: 'debts', label: 'Veresiye', count: debtors },
        ]}
      />
      <div style={{ marginTop: 16 }}>
        {tab === 'tickets' && <TicketsTab />}
        {tab === 'day' && <DayCloseTab onShowOpen={(ids) => { setTab('tickets'); setParams(ids.length === 1 ? { adisyon: ids[0] } : {}) }} />}
        {tab === 'expenses' && <ExpensesTab />}
        {tab === 'debts' && <DebtsTab />}
      </div>
    </div>
  )
}

function TicketsTab() {
  const repos = useRepos()
  const { branch, user } = useSession()
  const isMobile = useIsMobile()
  const [params, setParams] = useSearchParams()
  const today = todayIstanbul()
  const selectedId = params.get('adisyon')
  const select = (id: string | null) => setParams(id ? { adisyon: id } : {})
  const open = repos.tickets.list({ status: 'open' }).filter((t) => t.branchId === branch?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const closedToday = repos.tickets.list({ status: 'closed', date: today }).filter((t) => t.branchId === branch?.id).sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))
  const selected = selectedId ? repos.tickets.get(selectedId) : undefined
  const custName = (id: string | null) => (id ? repos.customers.get(id)?.name : undefined) ?? 'Müşterisiz'
  // Bugün işlemde/gelmiş ama adisyonu açılmamış randevular
  const waiting = repos.appointments.list({ date: today }).filter((a) => a.branchId === branch?.id && (a.status === 'in_service' || a.status === 'arrived') && !repos.tickets.list({ appointmentId: a.id }).length)

  const newTicket = () => {
    if (!branch) return
    const t = cashService(repos, user).openTicket({ branchId: branch.id, customerId: null })
    select(t.id)
  }

  const list = (
    <div className="ticket-list">
      <Button variant="primary" icon={Plus} block onClick={newTicket}>Yeni adisyon</Button>
      {waiting.length > 0 && (
        <>
          <div className="tl-label">Salonda · adisyon bekliyor</div>
          {waiting.map((a) => (
            <button key={a.id} className="tk-item waiting" onClick={() => select(appointmentService(repos).toTicket(a.id).id)}>
              <Avatar name={custName(a.customerId)} size={34} />
              <div><b>{custName(a.customerId)}</b><span>{toHHMM(a.start)} · {repos.staff.get(a.staffId)?.name.split(' ')[0]}</span></div>
              <em>{formatTRY(a.items.reduce((s, i) => s + i.price, 0))}</em>
            </button>
          ))}
        </>
      )}
      <div className="tl-label">Açık adisyonlar</div>
      {open.length === 0 && <p className="muted t-small" style={{ padding: '4px 4px 10px' }}>Açık adisyon yok.</p>}
      {open.map((t) => {
        const tt = ticketTotals(t)
        return (
          <button key={t.id} className={cx('tk-item', selectedId === t.id && 'on')} onClick={() => select(t.id)}>
            <Avatar name={custName(t.customerId)} size={34} />
            <div><b>{custName(t.customerId)}</b><span>{t.lines.length} kalem{t.date !== today && ` · ${formatDate(t.date)}`}</span></div>
            <em>{formatTRY(tt.total)}</em>
          </button>
        )
      })}
      <div className="tl-label">Bugün kapananlar · {closedToday.length}</div>
      {closedToday.slice(0, 30).map((t) => (
        <button key={t.id} className={cx('tk-item closed', selectedId === t.id && 'on')} onClick={() => select(t.id)}>
          <Avatar name={custName(t.customerId)} size={34} />
          <div><b>{custName(t.customerId)}</b><span>{t.payments.map((p) => METHOD_LABEL[p.method]).join(' + ')}</span></div>
          <em>{formatTRY(ticketTotals(t).total)}</em>
        </button>
      ))}
    </div>
  )

  if (isMobile) {
    if (selected) return (
      <div className="stack">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => select(null)} style={{ alignSelf: 'flex-start' }}>Adisyonlar</Button>
        <div className="card card-pad"><TicketEditor key={selected.id} ticket={selected} onClosed={() => {}} onDeleted={() => select(null)} /></div>
      </div>
    )
    return list
  }

  return (
    <div className="cash-layout">
      <aside className="card">{list}</aside>
      <section className="card card-pad">
        {selected ? (
          <TicketEditor key={selected.id} ticket={selected} onClosed={() => {}} onDeleted={() => select(null)} />
        ) : (
          <EmptyState icon={Receipt} title="Bir adisyon seçin" text="Soldan açık bir adisyon seçin ya da yenisini oluşturun. Takvimdeki randevudan da 'Tamamla & ödeme al' ile gelebilirsiniz." action={<Button variant="primary" icon={Plus} onClick={newTicket}>Yeni adisyon</Button>} />
        )}
      </section>
    </div>
  )
}

function DayCloseTab({ onShowOpen }: { onShowOpen: (ticketIds: string[]) => void }) {
  const repos = useRepos()
  const { branch, user } = useSession()
  const toast = useToast()
  const confirm = useConfirm()
  const [date, setDate] = useState(todayIstanbul())
  const cash = cashService(repos, user)
  const d = cash.dayCash(branch?.id ?? '', date)
  const close = repos.dayCloses.list({ branchId: branch?.id ?? '', date })[0]
  const locked = !!close?.locked
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const countedK = counted ? parseTRY(counted) : null
  const diff = countedK === null ? null : countedK - d.expectedCash
  const openList = repos.tickets.list({ status: 'open', date }).filter((t) => t.branchId === branch?.id)
  const openTickets = openList.length
  const history = repos.dayCloses.list({ branchId: branch?.id ?? '' }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)

  return (
    <>
    <div className="day-layout">
      <div className="stack">
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" onClick={() => setDate(addDays(date, -1))}>‹</Button>
          <b>{formatDate(date, { weekday: true, year: true })}</b>
          <Button size="sm" onClick={() => setDate(addDays(date, 1))} disabled={date >= todayIstanbul()}>›</Button>
          <div className="spacer" />
          {locked ? <Badge tone="neutral" icon={Lock}>Kapatıldı</Badge> : <Badge tone="success" icon={LockOpen}>Açık</Badge>}
        </div>
        <div className="kpis">
          <Kpi icon={Wallet} label="Ciro" value={formatTRY(d.revenue)} />
          <Kpi icon={Banknote} label="Nakit" value={formatTRY(d.by.cash)} tone="var(--success)" />
          <Kpi icon={CreditCard} label="Kart" value={formatTRY(d.by.card)} tone="var(--info)" />
          <Kpi icon={Landmark} label="Havale" value={formatTRY(d.by.transfer)} tone="#8e6cf0" />
          <Kpi icon={NotebookPen} label="Veresiye" value={formatTRY(d.by.debt)} tone="var(--danger)" />
          <Kpi icon={TrendingDown} label="Gider" value={formatTRY(d.expenseTotal)} tone="var(--warning)" />
        </div>
        <div className="card card-pad">
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>Nakit hesabı</h3>
          <div className="sum-row"><span className="muted">Nakit satış</span><span>{formatTRY(d.by.cash)}</span></div>
          <div className="sum-row"><span className="muted">Nakit veresiye tahsilatı</span><span>+{formatTRY(d.collected.cash)}</span></div>
          <div className="sum-row"><span className="muted">Nakit gider</span><span>-{formatTRY(d.expenseCash)}</span></div>
          <div className="sum-row total"><span>Kasada olması gereken</span><span>{formatTRY(d.expectedCash)}</span></div>
          <p className="t-small muted" style={{ marginTop: 8 }}>{d.tickets.length} adisyon kapandı{openTickets > 0 && <> · <button className="open-link" onClick={() => onShowOpen(openList.map((t) => t.id))}>{openTickets} açık adisyon var →</button></>}</p>
        </div>
      </div>

      <div className="card card-pad stack">
        {locked ? (
          <>
            <h3 style={{ fontSize: 16 }}>Gün kapatıldı</h3>
            <div className="sum-row"><span className="muted">Beklenen</span><span>{formatTRY(close.expectedCash)}</span></div>
            <div className="sum-row"><span className="muted">Sayılan</span><span>{formatTRY(close.countedCash)}</span></div>
            <div className="sum-row total"><span>Fark</span><span style={{ color: close.countedCash - close.expectedCash === 0 ? 'var(--success)' : 'var(--danger)' }}>{formatTRY(close.countedCash - close.expectedCash)}</span></div>
            {close.note && <div className="note-box">{close.note}</div>}
            <p className="t-small muted">Kapatan: {repos.users.get(close.closedBy)?.name ?? '—'}. Kapanmış günde ödeme, gider veya tahsilat girilemez.</p>
            {user?.role === 'owner' && (
              <Button icon={LockOpen} onClick={async () => {
                if (await confirm({ title: 'Kasa yeniden açılsın mı?', text: 'Bu gün için tekrar işlem yapılabilecek.', confirm: 'Aç' })) { cash.reopenDay(close.id); toast('Kasa açıldı') }
              }}>Kasayı aç</Button>
            )}
          </>
        ) : (
          <>
            <h3 style={{ fontSize: 16 }}>Gün sonu kapanışı</h3>
            <Field label="Kasada sayılan nakit (₺)">
              <Input inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder={String(d.expectedCash / 100)} style={{ fontSize: 20, height: 52, fontWeight: 700 }} />
            </Field>
            {diff !== null && (
              <div className={cx('pay-status', diff === 0 ? 'ok' : 'over')}>
                {diff === 0 ? 'Kasa tutuyor ✓' : diff > 0 ? `Fazla: ${formatTRY(diff)}` : `Eksik: ${formatTRY(-diff)}`}
              </div>
            )}
            <Field label="Not"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Fark açıklaması…" /></Field>
            <Button variant="primary" size="lg" icon={Lock} disabled={countedK === null} onClick={async () => {
              const warn = openTickets ? `${openTickets} açık adisyon var; kapatırsanız bu gün için ödeme alınamaz. ` : ''
              if (await confirm({ title: 'Gün kapatılsın mı?', text: `${warn}Kapanıştan sonra kayıtlar kilitlenir, yalnızca salon sahibi açabilir.`, confirm: 'Günü kapat' })) {
                cash.closeDay(branch!.id, date, countedK!, note)
                toast('Gün sonu kapatıldı')
                setCounted(''); setNote('')
              }
            }}>Günü kapat</Button>
          </>
        )}
        <div className="divider" />
        <div className="tl-label" style={{ padding: 0 }}>Son kapanışlar</div>
        <div className="history-mini">
          {history.map((h) => {
            const df = h.countedCash - h.expectedCash
            return (
              <div key={h.id} className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <button className="link-btn" onClick={() => setDate(h.date)}>{formatDate(h.date)}</button>
                <span className="num">{formatTRY(h.countedCash)}</span>
                <span className="num" style={{ color: df === 0 ? 'var(--muted)' : 'var(--danger)', minWidth: 60, textAlign: 'right' }}>{df === 0 ? '✓' : formatTRY(df)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
    <PayersCard branchId={branch?.id ?? ''} date={date} />
    </>
  )
}

const PAYER_METHODS = [
  { m: 'cash' as const, label: 'Nakit', icon: Banknote, tone: 'var(--success)' },
  { m: 'card' as const, label: 'Kart', icon: CreditCard, tone: 'var(--info)' },
  { m: 'transfer' as const, label: 'Havale / EFT', icon: Landmark, tone: '#8e6cf0' },
]

function PayersCard({ branchId, date }: { branchId: string; date: string }) {
  const repos = useRepos()
  const { user } = useSession()
  const p = cashService(repos, user).payers(branchId, date)
  const totalPeople = new Set(PAYER_METHODS.flatMap(({ m }) => p[m].entries.map((e) => (e.customerId ? e.customerId : e.key)))).size
  const exportCsv = () => {
    const rows: (string | number)[][] = [['Ödeme yöntemi', 'Müşteri', 'Tutar (TL)', 'Not']]
    for (const { m, label } of PAYER_METHODS) for (const e of p[m].entries) rows.push([label, e.name, (e.amount / 100).toFixed(2).replace('.', ','), e.collection ? 'Veresiye tahsilatı' : e.count > 1 ? `${e.count} ödeme` : ''])
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' }))
    a.download = `odeme-alinanlar-${date}.csv`
    a.click()
  }
  return (
    <div className="card payers-card">
      <div className="card-head">
        <div>
          <h3>Ödeme alınanlar</h3>
          <p className="t-small muted">{formatDate(date, { weekday: true })} · toplam {totalPeople} kişi</p>
        </div>
        <Button size="sm" variant="ghost" icon={Download} onClick={exportCsv}>CSV</Button>
      </div>
      <div className="payers-grid">
        {PAYER_METHODS.map(({ m, label, icon: Icon, tone }) => {
          const g = p[m]
          return (
            <section key={m} className="payer-col" style={{ ['--pc' as string]: tone }}>
              <header>
                <span className="payer-ico"><Icon /></span>
                <div><b>{label}</b><span>{g.people} kişi</span></div>
                <em className="num">{formatTRY(g.total)}</em>
              </header>
              <div className="payer-list">
                {g.entries.length === 0 && <p className="muted t-small" style={{ padding: '10px 2px' }}>Bu yöntemle ödeme yok.</p>}
                {g.entries.map((e) => (
                  <div key={e.key} className="payer-row">
                    <Avatar name={e.name} size={26} color={e.customerId ? undefined : 'var(--faint)'} />
                    <span className="payer-name">
                      {e.name}
                      {e.collection && <Badge tone="warning">tahsilat</Badge>}
                      {e.count > 1 && <span className="muted t-small"> ×{e.count}</span>}
                    </span>
                    <b className="num">{formatTRY(e.amount)}</b>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

const EXPENSE_CATS = ['Malzeme', 'Kira', 'Fatura', 'Maaş / Avans', 'Temizlik', 'Mutfak / İkram', 'Kargo', 'Diğer']

function ExpensesTab() {
  const repos = useRepos()
  const { branch, user } = useSession()
  const toast = useToast()
  const today = todayIstanbul()
  const [f, setF] = useState({ category: 'Malzeme', amount: '', method: 'cash' as Exclude<PaymentMethod, 'debt'>, note: '' })
  const list = repos.expenses.list({ branchId: branch?.id ?? '' }).filter((e) => e.date >= addDays(today, -30)).sort((a, b) => b.date.localeCompare(a.date))
  const total30 = list.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="day-layout">
      <div className="card">
        <div className="card-head"><h3>Son 30 gün</h3><b className="num">{formatTRY(total30)}</b></div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="table">
            <thead><tr><th>Tarih</th><th>Kategori</th><th>Not</th><th>Ödeme</th><th className="r">Tutar</th></tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}><td className="muted">{formatDate(e.date)}</td><td>{e.category}</td><td className="muted">{e.note}</td><td>{METHOD_LABEL[e.method]}</td><td className="r num t-strong">{formatTRY(e.amount)}</td></tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <EmptyState icon={TrendingDown} title="Gider yok" />}
        </div>
      </div>
      <div className="card card-pad stack">
        <h3 style={{ fontSize: 16 }}>Gider ekle</h3>
        <Field label="Kategori"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{EXPENSE_CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <div className="grid-2">
          <Field label="Tutar (₺)"><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Ödeme"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as typeof f.method })}><option value="cash">Nakit (kasadan)</option><option value="card">Kart</option><option value="transfer">Havale/EFT</option></Select></Field>
        </div>
        <Field label="Açıklama"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <Button variant="primary" icon={Plus} disabled={parseTRY(f.amount) <= 0} onClick={() => {
          const r = cashService(repos, user).addExpense({ branchId: branch!.id, category: f.category, amount: parseTRY(f.amount), method: f.method, note: f.note })
          if (!r.ok) { toast(CASH_ERROR_TEXT[r.error], 'error'); return }
          toast('Gider eklendi'); setF({ ...f, amount: '', note: '' })
        }}>Ekle</Button>
      </div>
    </div>
  )
}

function DebtsTab() {
  const repos = useRepos()
  const { branch, user } = useSession()
  const toast = useToast()
  const [collect, setCollect] = useState<{ id: string; name: string; balance: number } | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const cs = customerService(repos)
  const rows = repos.customers.list().map((c) => ({ c, balance: cs.balance(c.id) })).filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance)
  const total = rows.reduce((s, r) => s + r.balance, 0)

  return (
    <>
      <div className="card">
        <div className="card-head"><h3>Açık veresiyeler</h3><b className="num" style={{ color: 'var(--danger)' }}>{formatTRY(total)}</b></div>
        <div className="list" style={{ marginTop: 8 }}>
          {rows.length === 0 && <EmptyState icon={NotebookPen} title="Açık veresiye yok" />}
          {rows.map(({ c, balance }) => (
            <div key={c.id} className="list-item">
              <Avatar name={c.name} size={34} />
              <div style={{ flex: 1 }}><div className="t-strong">{c.name}</div><div className="t-small muted">{formatPhone(c.phone)}</div></div>
              <b className="num" style={{ color: 'var(--danger)' }}>{formatTRY(balance)}</b>
              <Button size="sm" onClick={() => { setCollect({ id: c.id, name: c.name, balance }); setAmount(String(balance / 100).replace('.', ',')) }}>Tahsil et</Button>
            </div>
          ))}
        </div>
      </div>
      {collect && (
        <Modal
          title={`Tahsilat · ${collect.name}`}
          onClose={() => setCollect(null)}
          footer={<><Button variant="ghost" onClick={() => setCollect(null)}>Vazgeç</Button><Button variant="primary" onClick={() => {
            const r = cashService(repos, user).collectDebt(collect.id, parseTRY(amount), method, branch!.id)
            if (!r.ok) { toast(CASH_ERROR_TEXT[r.error], 'error'); return }
            toast('Tahsilat kaydedildi'); setCollect(null)
          }}>Tahsil et</Button></>}
        >
          <p className="muted">Açık borç: <b style={{ color: 'var(--danger)' }}>{formatTRY(collect.balance)}</b></p>
          <div className="grid-2">
            <Field label="Tutar (₺)"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Ödeme"><Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}><option value="cash">Nakit</option><option value="card">Kart</option><option value="transfer">Havale/EFT</option></Select></Field>
          </div>
        </Modal>
      )}
    </>
  )
}
