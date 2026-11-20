import { useMemo, useRef, useState } from 'react'
import './charts.css'

/** Tek seri alan grafiği: 2px çizgi, hafif dolgu, sade ızgara, çapraz çizgi + tooltip. */
export function AreaChart({ data, format, height = 240, label }: { data: { x: string; label: string; y: number }[]; format: (n: number) => string; height?: number; label: string }) {
  const W = 800
  const H = height
  const pad = { l: 8, r: 8, t: 16, b: 26 }
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const max = Math.max(1, ...data.map((d) => d.y))
  const nice = useMemo(() => {
    const p = Math.pow(10, Math.floor(Math.log10(max)))
    return Math.ceil(max / p) * p
  }, [max])
  const x = (i: number) => pad.l + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - pad.l - pad.r))
  const y = (v: number) => pad.t + (1 - v / nice) * (H - pad.t - pad.b)
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.y).toFixed(1)}`).join('')
  const area = `${line}L${x(data.length - 1)},${H - pad.b}L${x(0)},${H - pad.b}Z`
  const step = Math.max(1, Math.ceil(data.length / 8))

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }

  return (
    <div className="chart" role="img" aria-label={label}>
      <div className="chart-y">
        <span style={{ top: `${(y(nice) / H) * 100}%` }}>{format(nice)}</span>
        <span style={{ top: `${(y(nice / 2) / H) * 100}%` }}>{format(nice / 2)}</span>
      </div>
      <div className="chart-plot">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => <line key={f} x1={pad.l} x2={W - pad.r} y1={y(nice * f)} y2={y(nice * f)} className="grid" vectorEffect="non-scaling-stroke" />)}
        <path d={area} fill="url(#area-fill)" />
        <path d={line} className="series" vectorEffect="non-scaling-stroke" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} className="cross" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hover !== null && (
        <>
          <span className="chart-dot" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].y) / H) * 100}%` }} />
          <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
            <span>{data[hover].label}</span>
            <b>{format(data[hover].y)}</b>
          </div>
        </>
      )}
      <div className="chart-x">
        {data.map((d, i) => (i % step === 0 || i === data.length - 1) && (
          <span key={d.x} style={{ left: `${(x(i) / W) * 100}%` }}>{d.x}</span>
        ))}
      </div>
      </div>
    </div>
  )
}

/** Sıralı yatay çubuklar (tek renk); değerler metin renginde. */
export function BarList({ rows, format, max }: { rows: { key: string; label: string; value: number; sub?: string }[]; format: (n: number) => string; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value))
  const [hover, setHover] = useState<string | null>(null)
  return (
    <div className="barlist">
      {rows.map((r) => (
        <div key={r.key} className={`bl-row ${hover && hover !== r.key ? 'dim' : ''}`} onPointerEnter={() => setHover(r.key)} onPointerLeave={() => setHover(null)} title={`${r.label}: ${format(r.value)}${r.sub ? ` · ${r.sub}` : ''}`}>
          <div className="bl-head">
            <span className="bl-label">{r.label}</span>
            <span className="bl-val">{format(r.value)}{r.sub && <small> · {r.sub}</small>}</span>
          </div>
          <div className="bl-track"><i style={{ width: `${Math.max(1, (r.value / top) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  )
}
