import { CheckCircle2, Clock3, Globe, Footprints, Sparkles, UserX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { STATUS_LABEL } from '../../application/appointmentService'
import { toHHMM } from '../../domain/time'
import type { Appointment, CategoryKey, Customer, TimeBlock } from '../../domain/types'
import { cx } from '../../ui'

export const PX = 1.6 // dakika başına piksel
const SNAP = 15

export interface Column {
  key: string
  staffId: string
  date: string
  head: ReactNode
  work: { start: number; end: number } | null
  isToday?: boolean
}

export interface GridData {
  appts: Appointment[]
  blocks: TimeBlock[]
  customer: (id: string | null) => Customer | undefined
  serviceName: (id: string) => string
  categoryOf: (serviceId: string) => CategoryKey
}

interface Props {
  columns: Column[]
  range: { start: number; end: number }
  data: GridData
  nowMin: number | null
  selectedId?: string | null
  onSlotClick: (col: Column, start: number) => void
  onOpen: (a: Appointment) => void
  onMove: (a: Appointment, to: { staffId: string; date: string; start: number }) => void
  onResize: (a: Appointment, end: number) => void
  readOnly?: boolean
  minColWidth?: number
}

type Drag =
  | { kind: 'move'; id: string; dx: number; dy: number; startX: number; startY: number; grabOffset: number; colKey: string; start: number; active: boolean }
  | { kind: 'resize'; id: string; startY: number; end: number; active: boolean }

/** Aynı sütunda çakışan randevuları yan yana şeritlere dağıtır. */
function layoutLanes(list: Appointment[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...list].sort((a, b) => a.start - b.start || b.end - a.end)
  const out = new Map<string, { lane: number; lanes: number }>()
  let cluster: Appointment[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1
  const flush = () => {
    for (const a of cluster) out.get(a.id)!.lanes = laneEnds.length
    cluster = []
    laneEnds = []
  }
  for (const a of sorted) {
    if (a.start >= clusterEnd) flush()
    let lane = laneEnds.findIndex((e) => e <= a.start)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(a.end) } else laneEnds[lane] = a.end
    out.set(a.id, { lane, lanes: 1 })
    cluster.push(a)
    clusterEnd = Math.max(clusterEnd, a.end)
  }
  flush()
  return out
}

const catStyle = (k: CategoryKey): CSSProperties => ({
  ['--c-bg' as string]: `var(--cat-${k}-bg)`,
  ['--c-bd' as string]: `var(--cat-${k}-bd)`,
  ['--c-fg' as string]: `var(--cat-${k}-fg)`,
})

function StatusIcon({ a }: { a: Appointment }) {
  if (a.status === 'pending') return <Clock3 className="ap-st warn" aria-label={STATUS_LABEL.pending} />
  if (a.status === 'arrived') return <Footprints className="ap-st" aria-label={STATUS_LABEL.arrived} />
  if (a.status === 'in_service') return <Sparkles className="ap-st pulse" aria-label={STATUS_LABEL.in_service} />
  if (a.status === 'completed') return <CheckCircle2 className="ap-st" aria-label={STATUS_LABEL.completed} />
  if (a.status === 'no_show') return <UserX className="ap-st danger" aria-label={STATUS_LABEL.no_show} />
  return null
}

export function TimeGrid({ columns, range, data, nowMin, selectedId, onSlotClick, onOpen, onMove, onResize, readOnly, minColWidth = 150 }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [hover, setHover] = useState<{ colKey: string; start: number } | null>(null)
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag

  const height = (range.end - range.start) * PX
  const hours = useMemo(() => {
    const out: number[] = []
    for (let m = Math.ceil(range.start / 60) * 60; m <= range.end; m += 60) out.push(m)
    return out
  }, [range])

  const byCol = useMemo(() => {
    const m = new Map<string, { appts: Appointment[]; blocks: TimeBlock[]; lanes: Map<string, { lane: number; lanes: number }> }>()
    for (const c of columns) {
      const appts = data.appts.filter((a) => a.staffId === c.staffId && a.date === c.date && a.status !== 'cancelled')
      m.set(c.key, { appts, blocks: data.blocks.filter((b) => b.staffId === c.staffId && b.date === c.date), lanes: layoutLanes(appts) })
    }
    return m
  }, [columns, data])

  // Açılışta "şimdi"ye ya da ilk randevuya kaydır
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const firstAppt = Math.min(...data.appts.filter((a) => columns.some((c) => c.date === a.date)).map((a) => a.start), range.end)
    const target = nowMin !== null && nowMin > range.start && nowMin < range.end ? nowMin - 60 : firstAppt - 30
    el.scrollTop = Math.max(0, (target - range.start) * PX)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.map((c) => c.key).join(), range.start])

  const minuteAt = (clientY: number, colEl: Element) => {
    const rect = colEl.getBoundingClientRect()
    const raw = range.start + (clientY - rect.top) / PX
    return Math.max(range.start, Math.min(range.end - SNAP, Math.floor(raw / SNAP) * SNAP))
  }

  const colAt = (clientX: number): { col: Column; el: Element } | null => {
    const els = bodyRef.current?.querySelectorAll('[data-col]') ?? []
    for (const el of els) {
      const r = el.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right) return { col: columns.find((c) => c.key === (el as HTMLElement).dataset.col)!, el }
    }
    return null
  }

  useEffect(() => {
    if (!drag) return
    const onMoveEv = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      if (d.kind === 'move') {
        const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY)
        const active = d.active || dist > 5
        const hit = colAt(e.clientX)
        let start = d.start
        let colKey = d.colKey
        if (active && hit) {
          colKey = hit.col.key
          const rect = hit.el.getBoundingClientRect()
          const raw = range.start + (e.clientY - rect.top - d.grabOffset) / PX
          start = Math.max(range.start, Math.min(range.end - SNAP, Math.round(raw / SNAP) * SNAP))
        }
        setDrag({ ...d, active, colKey, start, dx: e.clientX - d.startX, dy: e.clientY - d.startY })
      } else {
        const a = data.appts.find((x) => x.id === d.id)!
        const raw = a.end + (e.clientY - d.startY) / PX
        setDrag({ ...d, active: true, end: Math.max(a.start + SNAP, Math.min(range.end, Math.round(raw / SNAP) * SNAP)) })
      }
    }
    const onUp = () => {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      const a = data.appts.find((x) => x.id === d.id)
      if (!a) return
      if (d.kind === 'move') {
        if (!d.active) { onOpen(a); return }
        const col = columns.find((c) => c.key === d.colKey)!
        if (col.staffId !== a.staffId || col.date !== a.date || d.start !== a.start) onMove(a, { staffId: col.staffId, date: col.date, start: d.start })
      } else if (d.active && d.end !== a.end) onResize(a, d.end)
    }
    window.addEventListener('pointermove', onMoveEv)
    window.addEventListener('pointerup', onUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onMoveEv)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, drag?.kind])

  const dragging = drag?.active ? drag : null
  const draggedAppt = dragging ? data.appts.find((a) => a.id === dragging.id) : null

  return (
    <div className="tg" style={{ ['--px' as string]: PX }}>
      <div className="tg-scroll" ref={scrollRef}>
        <div className="tg-inner" style={{ minWidth: 56 + columns.length * minColWidth }}>
          <div className="tg-head">
            <div className="tg-corner" />
            {columns.map((c) => (
              <div key={c.key} className={cx('tg-colhead', c.isToday && 'today', !c.work && 'off')}>{c.head}</div>
            ))}
          </div>
          <div className="tg-body" ref={bodyRef} style={{ height }}>
            <div className="tg-hours">
              {hours.map((m) => (
                <div key={m} className="tg-hour" style={{ top: (m - range.start) * PX }}>{toHHMM(m)}</div>
              ))}
            </div>
            {columns.map((c) => {
              const info = byCol.get(c.key)!
              const isDropTarget = dragging?.kind === 'move' && dragging.colKey === c.key
              return (
                <div
                  key={c.key}
                  data-col={c.key}
                  className={cx('tg-col', !c.work && 'off', isDropTarget && 'drop')}
                  onPointerMove={(e) => {
                    if (readOnly || drag || (e.target as HTMLElement).closest('.ap')) return setHover(null)
                    setHover({ colKey: c.key, start: minuteAt(e.clientY, e.currentTarget) })
                  }}
                  onPointerLeave={() => setHover(null)}
                  onClick={(e) => {
                    if (readOnly || (e.target as HTMLElement).closest('.ap, .blk')) return
                    onSlotClick(c, minuteAt(e.clientY, e.currentTarget))
                  }}
                >
                  {hours.map((m) => <div key={m} className="tg-line" style={{ top: (m - range.start) * PX }} />)}
                  {c.work ? (
                    <>
                      {c.work.start > range.start && <div className="tg-closed" style={{ top: 0, height: (c.work.start - range.start) * PX }} />}
                      {c.work.end < range.end && <div className="tg-closed" style={{ top: (c.work.end - range.start) * PX, bottom: 0 }} />}
                    </>
                  ) : (
                    <div className="tg-closed full"><span>Çalışmıyor</span></div>
                  )}
                  {info.blocks.map((b) => {
                    const s = Math.max(b.start, range.start)
                    const e = Math.min(b.end, range.end)
                    if (e <= s) return null
                    return (
                      <div key={b.id} className={cx('blk', b.kind)} style={{ top: (s - range.start) * PX, height: (e - s) * PX }}>
                        <span>{b.kind === 'leave' ? 'İzinli' : b.kind === 'break' ? 'Mola' : 'Toplantı'}{b.note ? ` · ${b.note}` : ''}</span>
                      </div>
                    )
                  })}
                  {hover?.colKey === c.key && c.work && (
                    <div className="tg-hover" style={{ top: (hover.start - range.start) * PX }}>
                      <span>+ {toHHMM(hover.start)}</span>
                    </div>
                  )}
                  {isDropTarget && draggedAppt && (
                    <div className="tg-ghost" style={{ top: (dragging.start - range.start) * PX, height: (draggedAppt.end - draggedAppt.start) * PX }}>
                      <span>{toHHMM(dragging.start)} – {toHHMM(dragging.start + draggedAppt.end - draggedAppt.start)}</span>
                    </div>
                  )}
                  {info.appts.map((a) => {
                    const lane = info.lanes.get(a.id)!
                    const isDrag = dragging?.id === a.id
                    const end = isDrag && dragging.kind === 'resize' ? dragging.end : a.end
                    const cust = data.customer(a.customerId)
                    const h = (end - a.start) * PX
                    const cat = data.categoryOf(a.items[0]?.serviceId ?? '')
                    const style: CSSProperties = {
                      ...catStyle(cat),
                      top: (a.start - range.start) * PX,
                      height: Math.max(h, 18),
                      left: `calc(${(lane.lane / lane.lanes) * 100}% + 3px)`,
                      width: `calc(${100 / lane.lanes}% - 6px)`,
                      transform: isDrag && dragging.kind === 'move' ? `translate(${dragging.dx}px, ${dragging.dy}px)` : undefined,
                    }
                    return (
                      <div
                        key={a.id}
                        className={cx('ap', `s-${a.status}`, h < 40 && 'compact', isDrag && 'dragging', selectedId === a.id && 'selected')}
                        style={style}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return
                          e.stopPropagation()
                          if (readOnly) return onOpen(a)
                          const rect = e.currentTarget.getBoundingClientRect()
                          setDrag({ kind: 'move', id: a.id, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, grabOffset: e.clientY - rect.top, colKey: c.key, start: a.start, active: false })
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && onOpen(a)}
                        tabIndex={0}
                        role="button"
                        aria-label={`${toHHMM(a.start)} ${cust?.name ?? 'Randevusuz müşteri'}`}
                      >
                        <div className="ap-top">
                          <span className="ap-time">{toHHMM(a.start)}{h >= 40 && ` – ${toHHMM(end)}`}</span>
                          <span className="ap-icons">
                            {a.source === 'online' && <Globe className="ap-st" aria-label="Online" />}
                            <StatusIcon a={a} />
                          </span>
                        </div>
                        <b className="ap-name">{cust?.name ?? 'Randevusuz müşteri'}</b>
                        {h >= 52 && <span className="ap-svc">{a.items.map((i) => data.serviceName(i.serviceId)).join(' + ')}</span>}
                        {!readOnly && (
                          <div
                            className="ap-resize"
                            onPointerDown={(e) => {
                              e.stopPropagation()
                              setDrag({ kind: 'resize', id: a.id, startY: e.clientY, end: a.end, active: false })
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                  {c.isToday && nowMin !== null && nowMin >= range.start && nowMin <= range.end && (
                    <div className="tg-now" style={{ top: (nowMin - range.start) * PX }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
