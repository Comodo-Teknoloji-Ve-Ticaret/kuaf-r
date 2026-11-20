import { CalendarCheck2, Download, Gauge, Receipt, Sparkles, TrendingUp, UserX, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { METHOD_LABEL } from '../../application/cashService'
import { daysIn, reportService, toCSV, type Range } from '../../application/reportService'
import { useSession } from '../../app/session'
import { formatTRY } from '../../domain/money'
import { addDays, dayShort, diffDays, formatDate, todayIstanbul } from '../../domain/time'
import type { PaymentMethod } from '../../domain/types'
import { useRepos } from '../../infrastructure'
import { AreaChart, BarList } from '../../ui/charts'
import { Avatar, Button, Kpi, PageHeader, Segmented, Select } from '../../ui'
import './reports.css'

type Preset = 'today' | '7d' | '30d' | 'month' | 'lastMonth'

function rangeFor(p: Preset, today: string): Range {
  const [y, m] = today.split('-').map(Number)
  const first = `${today.slice(0, 7)}-01`
  if (p === 'today') return { from: today, to: today }
  if (p === '7d') return { from: addDays(today, -6), to: today }
  if (p === '30d') return { from: addDays(today, -29), to: today }
  if (p === 'month') return { from: first, to: today }
  const prev = new Date(Date.UTC(y, m - 2, 1))
  const pf = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-01`
  return { from: pf, to: addDays(first, -1) }
}

const compact = (k: number) => {
  const tl = k / 100
  if (tl >= 1_000_000) return `₺${(tl / 1_000_000).toFixed(1).replace('.', ',')} mn`
  if (tl >= 1000) return `₺${Math.round(tl / 1000)} bin`
  return `₺${Math.round(tl)}`
}

function download(name: string, csv: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
}

export default function ReportsPage() {
  const repos = useRepos()
  const { branches } = useSession()
  const today = todayIstanbul()
  const [preset, setPreset] = useState<Preset>('30d')
  const [branch, setBranch] = useState<string>('')
  const [showTable, setShowTable] = useState(false)
  const range = rangeFor(preset, today)
  const len = diffDays(range.to, range.from) + 1
  const prevRange = { from: addDays(range.from, -len), to: addDays(range.from, -1) }
  const b = branch || undefined

  const r = useMemo(() => {
    const s = reportService(repos)
    const daily = s.revenue(range, b)
    const net = s.expensesNet(range, b)
    const prev = s.expensesNet(prevRange, b)
    const count = daily.reduce((a, d) => a + d.count, 0)
    return {
      daily, net, prev, count,
      avg: count ? Math.round(net.revenue / count) : 0,
      pay: s.byPayment(range, b),
      services: s.byService(range, b),
      staff: s.byStaff(range, b),
      occ: s.occupancy(range, b),
      noShow: s.noShows(range, b),
      nvr: s.newVsReturning(range, b),
    }
  }, [repos, range.from, range.to, b]) // eslint-disable-line react-hooks/exhaustive-deps

  const earliest = useMemo(() => repos.tickets.list({ status: 'closed' }).reduce((m, t) => (t.date < m ? t.date : m), today), [repos, today])
  const trend = r.prev.revenue && prevRange.from >= earliest ? Math.round(((r.net.revenue - r.prev.revenue) / r.prev.revenue) * 100) : null
  const payTotal = Object.values(r.pay).reduce((a, v) => a + v, 0)
  const chartData = r.daily.map((d) => ({ x: len <= 7 ? dayShort(d.date) : String(Number(d.date.slice(8))), label: formatDate(d.date, { weekday: true }), y: d.total }))

  return (
    <div className="page">
      <PageHeader
        title="Raporlar"
        subtitle={`${formatDate(range.from, { year: true })} – ${formatDate(range.to, { year: true })}`}
        actions={<Button icon={Download} onClick={() => download(`ciro-${range.from}_${range.to}.csv`, toCSV([['Tarih', 'Adisyon', 'Ciro (TL)'], ...r.daily.map((d) => [d.date, d.count, (d.total / 100).toFixed(2).replace('.', ',')])]))}>CSV</Button>}
      />
      <div className="rp-filters">
        <Segmented value={preset} onChange={setPreset} options={[{ value: 'today', label: 'Bugün' }, { value: '7d', label: '7 gün' }, { value: '30d', label: '30 gün' }, { value: 'month', label: 'Bu ay' }, { value: 'lastMonth', label: 'Geçen ay' }]} />
        {branches.length > 1 && (
          <Select value={branch} onChange={(e) => setBranch(e.target.value)} style={{ width: 180, height: 38, borderRadius: 999 }}>
            <option value="">Tüm şubeler</option>
            {branches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        )}
      </div>

      <div className="kpis rp-kpis">
        <Kpi icon={Wallet} label="Ciro" value={formatTRY(Math.round(r.net.revenue / 100) * 100)} trend={trend !== null ? { text: `${trend >= 0 ? '+' : ''}%${trend} önceki döneme göre`, up: trend >= 0 } : undefined} />
        <Kpi icon={Receipt} label={`${r.count} adisyon · ort. sepet`} value={formatTRY(Math.round(r.avg / 100) * 100)} tone="var(--info)" />
        <Kpi icon={TrendingUp} label={`Net (gider ${compact(r.net.expenses)})`} value={formatTRY(Math.round(r.net.net / 100) * 100)} tone="var(--success)" />
        <Kpi icon={Gauge} label="Doluluk" value={`%${r.occ}`} tone="#8e6cf0" />
        <Kpi icon={Sparkles} label={`Yeni müşteri · ${r.nvr.returning} dönen`} value={r.nvr.new} tone="#e84393" />
        <Kpi icon={UserX} label={`Gelmeme oranı · ${r.noShow.count} randevu`} value={`%${r.noShow.rate}`} tone="var(--danger)" />
      </div>

      <div className="card card-pad rp-main">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div><h3 style={{ fontSize: 15 }}>Günlük ciro</h3><p className="t-small muted">Kapanmış adisyonlar · imleci gezdirerek gün detayını görün</p></div>
          <Button size="sm" variant="ghost" onClick={() => setShowTable((v) => !v)}>{showTable ? 'Grafik' : 'Tablo'}</Button>
        </div>
        {showTable ? (
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="table"><thead><tr><th>Tarih</th><th className="r">Adisyon</th><th className="r">Ciro</th></tr></thead>
              <tbody>{[...r.daily].reverse().map((d) => <tr key={d.date}><td>{formatDate(d.date, { weekday: true })}</td><td className="r num">{d.count}</td><td className="r num t-strong">{formatTRY(d.total)}</td></tr>)}</tbody>
            </table>
          </div>
        ) : len === 1 ? (
          <div className="rp-single"><CalendarCheck2 /><b>{formatTRY(r.net.revenue)}</b><span>{r.count} adisyon bugün kapandı</span></div>
        ) : (
          <AreaChart data={chartData} format={compact} label="Günlük ciro grafiği" />
        )}
      </div>

      <div className="rp-grid">
        <div className="card card-pad">
          <h3 className="rp-h">Ödeme yöntemleri</h3>
          <BarList
            format={(n) => formatTRY(Math.round(n / 100) * 100)}
            max={payTotal}
            rows={(Object.keys(r.pay) as PaymentMethod[]).map((m) => ({ key: m, label: METHOD_LABEL[m], value: r.pay[m], sub: payTotal ? `%${Math.round((r.pay[m] / payTotal) * 100)}` : undefined }))}
          />
        </div>
        <div className="card card-pad">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 className="rp-h">En çok kazandıran hizmet & ürünler</h3>
            <Button size="sm" variant="ghost" icon={Download} onClick={() => download('hizmetler.csv', toCSV([['Hizmet/Ürün', 'Adet', 'Ciro (TL)'], ...r.services.map((s) => [s.name, s.count, (s.amount / 100).toFixed(2).replace('.', ',')])]))}>CSV</Button>
          </div>
          <BarList format={formatTRY} rows={r.services.slice(0, 8).map((s) => ({ key: s.id, label: s.name, value: s.amount, sub: `${s.count} adet` }))} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h3>Personel performansı</h3>
          <Button size="sm" variant="ghost" icon={Download} onClick={() => download('personel.csv', toCSV([['Personel', 'İşlem', 'Ciro (TL)', 'Prim (TL)'], ...r.staff.map((s) => [s.staff.name, s.services, (s.revenue / 100).toFixed(2).replace('.', ','), (s.commission / 100).toFixed(2).replace('.', ',')])]))}>CSV</Button>
        </div>
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="table">
            <thead><tr><th>Personel</th><th className="r">İşlem</th><th style={{ width: '32%' }}>Ciro</th><th className="r">Prim</th></tr></thead>
            <tbody>
              {r.staff.map((s) => (
                <tr key={s.staff.id}>
                  <td><div className="row" style={{ gap: 10 }}><Avatar name={s.staff.name} color={s.staff.color} size={30} /><div><div className="t-strong">{s.staff.name}</div><div className="t-small muted">{s.staff.title}</div></div></div></td>
                  <td className="r num">{s.services}</td>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <div className="bl-track" style={{ flex: 1 }}><i style={{ width: `${(s.revenue / Math.max(1, r.staff[0]?.revenue ?? 1)) * 100}%` }} /></div>
                      <b className="num" style={{ minWidth: 90, textAlign: 'right' }}>{formatTRY(s.revenue)}</b>
                    </div>
                  </td>
                  <td className="r num t-strong">{formatTRY(s.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="t-small muted" style={{ marginTop: 10 }}>{daysIn(range).length} günlük dönem · önceki dönem: {formatDate(prevRange.from)} – {formatDate(prevRange.to)}</p>
    </div>
  )
}
