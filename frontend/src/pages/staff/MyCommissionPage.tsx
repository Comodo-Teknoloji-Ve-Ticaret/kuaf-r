import { HandCoins, Receipt, Scissors, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../../app/session'
import { formatTRY } from '../../domain/money'
import { netLineAmounts } from '../../domain/ticket'
import { formatDate, monthName, todayIstanbul } from '../../domain/time'
import { useRepos } from '../../infrastructure'
import { EmptyState, Kpi, PageHeader, Select } from '../../ui'
import { commissionCtx } from '../../application/commissionCtx'
import { monthStats } from './StaffPage'
import './staff.css'

export default function MyCommissionPage() {
  const repos = useRepos()
  const { user } = useSession()
  const today = todayIstanbul()
  const [month, setMonth] = useState(today.slice(0, 7))
  const staff = user?.staffId ? repos.staff.get(user.staffId) : undefined
  if (!staff) return <div className="page"><EmptyState icon={HandCoins} title="Personel kaydınız bulunamadı" /></div>

  const st = monthStats(repos, staff, month)
  const months = Array.from({ length: 4 }, (_, i) => {
    const [y, m] = today.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
  const ctx = commissionCtx(repos)
  const rateFor = (l: { kind: string; refId: string }) => {
    if (l.kind === 'product') { const b = ctx.brandOf(l.refId); return (b ? staff.brandRates[b] : undefined) ?? staff.productCommission }
    const c = ctx.categoryOf(l.refId)
    return staff.serviceRates[l.refId] ?? (c ? staff.categoryRates[c] : undefined) ?? staff.serviceCommission
  }
  const lines = repos.tickets.list({ status: 'closed' })
    .filter((t) => t.date.startsWith(month))
    .flatMap((t) => {
      const net = netLineAmounts(t)
      return t.lines.filter((l) => l.staffId === staff.id && (l.kind === 'service' || l.kind === 'product')).map((l) => ({ t, l, amount: net.get(l.id) ?? 0 }))
    })
    .sort((a, b) => b.t.date.localeCompare(a.t.date))

  return (
    <div className="page">
      <PageHeader
        title="Primlerim"
        subtitle={`${staff.name} · ${staff.commissionMode === 'tiered' ? 'kademeli hizmet primi (aylık)' : 'kategori bazlı hizmet primi'}`}
        actions={
          <Select value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 170 }}>
            {months.map((m) => <option key={m} value={m}>{monthName(Number(m.slice(5)))} {m.slice(0, 4)}</option>)}
          </Select>
        }
      />
      <div className="kpis" style={{ marginBottom: 16 }}>
        <Kpi icon={HandCoins} label="Toplam prim" value={formatTRY(st.commission.total)} />
        <Kpi icon={Scissors} label="Hizmet primi" value={formatTRY(st.commission.service)} tone="var(--info)" />
        <Kpi icon={ShoppingBag} label="Ürün primi" value={formatTRY(st.commission.product)} tone="var(--success)" />
        <Kpi icon={Receipt} label="Ciro / işlem" value={`${formatTRY(st.revenue)} · ${st.services}`} tone="var(--warning)" />
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Tarih</th><th>İşlem</th><th className="r">Tutar</th><th className="r">Prim</th></tr></thead>
            <tbody>
              {lines.slice(0, 200).map(({ t, l, amount }) => (
                <tr key={l.id}>
                  <td className="muted">{formatDate(t.date)}</td>
                  <td>{l.name}</td>
                  <td className="r num">{formatTRY(amount)}</td>
                  <td className="r num t-strong">{staff.commissionMode === 'tiered' && l.kind === 'service' ? <span className="muted t-small">kademeli</span> : formatTRY(Math.round((amount * rateFor(l)) / 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lines.length === 0 && <EmptyState icon={Receipt} title="Bu ay kapanmış işlem yok" />}
        </div>
      </div>
    </div>
  )
}
