import { Check, Clock3 } from 'lucide-react'
import { appointmentService, SOURCE_LABEL } from '../../application/appointmentService'
import { formatPhone } from '../../domain/phone'
import { formatDate, toHHMM } from '../../domain/time'
import type { Appointment } from '../../domain/types'
import { useRepos } from '../../infrastructure'
import { Avatar, Badge, Button, Drawer, EmptyState, useToast } from '../../ui'

/** Onay bekleyen tüm randevular (bugün ve sonrası), tarihe göre gruplu. */
export function PendingList({ branchId, today, onOpen, onClose }: { branchId: string; today: string; onOpen: (a: Appointment) => void; onClose: () => void }) {
  const repos = useRepos()
  const toast = useToast()
  const svc = appointmentService(repos)
  const list = repos.appointments.list({ status: 'pending' })
    .filter((a) => a.branchId === branchId && a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
  const days = [...new Set(list.map((a) => a.date))]
  const approve = (a: Appointment, name: string) => { svc.setStatus(a.id, 'confirmed'); toast(`${name} onaylandı`) }
  return (
    <Drawer title="Onay bekleyenler" subtitle={list.length ? `${list.length} randevu onayınızı bekliyor` : undefined} onClose={onClose}>
      {list.length === 0 && <EmptyState icon={Clock3} title="Onay bekleyen randevu yok" text="Online gelen talepler burada listelenir." />}
      {days.map((d) => (
        <div key={d} className="pending-day">
          <div className="pending-date">{formatDate(d, { weekday: true })}{d === today && <Badge tone="accent">Bugün</Badge>}</div>
          <div className="list card">
            {list.filter((a) => a.date === d).map((a) => {
              const c = a.customerId ? repos.customers.get(a.customerId) : undefined
              const name = c?.name ?? 'Randevusuz müşteri'
              return (
                <div key={a.id} className="list-item clickable pending-row" onClick={() => onOpen(a)}>
                  <Avatar name={name} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-strong">{name}</div>
                    <div className="t-small muted">
                      <b className="num">{toHHMM(a.start)}</b> · {a.items.map((i) => repos.services.get(i.serviceId)?.name).join(', ')} · {repos.staff.get(a.staffId)?.name.split(' ')[0]}
                    </div>
                    <div className="t-small muted">{c ? formatPhone(c.phone) : ''}{c ? ' · ' : ''}{SOURCE_LABEL[a.source]}</div>
                  </div>
                  <Button size="sm" variant="primary" icon={Check} onClick={(e) => { e.stopPropagation(); approve(a, name.split(' ')[0]) }}>Onayla</Button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </Drawer>
  )
}
