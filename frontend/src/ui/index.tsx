import { CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react'
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import './ui.css'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
export { cx }

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  icon?: LucideIcon
  block?: boolean
}
export function Button({ variant = 'secondary', size = 'md', icon: Icon, block, className, children, ...rest }: BtnProps) {
  return (
    <button type="button" className={cx('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', className)} {...rest}>
      {Icon && <Icon />}
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, label, bordered, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; bordered?: boolean }) {
  return (
    <button type="button" className={cx('icon-btn', bordered && 'bordered', className)} aria-label={label} title={label} {...rest}>
      <Icon />
    </button>
  )
}

export function Field({ label, hint, error, children }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {error ? <span className="error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

export function Input({ icon: Icon, className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon; invalid?: boolean }) {
  const el = <input className={cx('input', invalid && 'invalid', className)} {...rest} />
  return Icon ? <div className="input-icon"><Icon />{el}</div> : el
}
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className="textarea" {...p} />
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={cx('select', className)} {...p} />

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={cx('switch', on && 'on')} onClick={() => onChange(!on)} />
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: LucideIcon }[] }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.icon && <o.icon />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
export function Badge({ tone = 'neutral', dot, icon: Icon, children }: { tone?: Tone; dot?: boolean; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={cx('badge', tone !== 'neutral' && tone)}>
      {dot && <span className="dot" />}
      {Icon && <Icon />}
      {children}
    </span>
  )
}

export function initials(name: string) {
  const parts = name.replace(/\(.*\)/, '').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toLocaleUpperCase('tr-TR')
}

const PALETTE = ['#e17055', '#0984e3', '#00b894', '#8e6cf0', '#e84393', '#fdcb6e', '#00cec9', '#6c5ce7', '#d63031', '#12a37b']
export function colorFor(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function Avatar({ name, color, size = 32 }: { name: string; color?: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: color ?? colorFor(name), color: '#fff', lineHeight: 1 }} aria-hidden>
      {initials(name)}
    </span>
  )
}

export function Kpi({ icon: Icon, label, value, trend, tone }: { icon: LucideIcon; label: string; value: ReactNode; trend?: { text: string; up: boolean }; tone?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-icon" style={tone ? { background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone } : undefined}>
        <Icon />
      </div>
      <div style={{ minWidth: 0 }}>
        <b>{value}</b>
        <span>
          {label}
          {trend && <span className={cx('trend', trend.up ? 'up' : 'down')}> · {trend.text}</span>}
        </span>
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon /></div>
      <h4>{title}</h4>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
}

export function Drawer({ title, subtitle, onClose, children, footer, wide }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEscape(onClose)
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <aside className={cx('drawer', wide && 'wide')} role="dialog" aria-modal>
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Kapat" onClick={onClose} />
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>,
    document.body,
  )
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEscape(onClose)
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal-wrap" onClick={onClose}>
        <div className={cx('modal', wide && 'wide')} role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h2>{title}</h2>
            <IconButton icon={X} label="Kapat" onClick={onClose} />
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </div>
      </div>
    </>,
    document.body,
  )
}

/** Onay modalı için promise tabanlı yardımcı */
type ConfirmOpts = { title: string; text: ReactNode; confirm?: string; danger?: boolean }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false)
export const useConfirm = () => useContext(ConfirmCtx)

type ToastT = { id: number; text: string; tone: 'success' | 'error' | 'info' }
const ToastCtx = createContext<(text: string, tone?: ToastT['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastT[]>([])
  const [confirmState, setConfirm] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const seq = useRef(0)
  const toast = useCallback((text: string, tone: ToastT['tone'] = 'success') => {
    const id = ++seq.current
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirm({ ...o, resolve })), [])
  const close = (v: boolean) => {
    confirmState?.resolve(v)
    setConfirm(null)
  }
  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        {confirmState && (
          <Modal
            title={confirmState.title}
            onClose={() => close(false)}
            footer={
              <>
                <Button variant="ghost" onClick={() => close(false)}>Vazgeç</Button>
                <Button variant={confirmState.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
                  {confirmState.confirm ?? 'Onayla'}
                </Button>
              </>
            }
          >
            <div className="muted">{confirmState.text}</div>
          </Modal>
        )}
        {createPortal(
          <div className="toasts" aria-live="polite">
            {toasts.map((t) => (
              <div key={t.id} className={cx('toast', t.tone)}>
                {t.tone === 'success' ? <CheckCircle2 /> : t.tone === 'error' ? <XCircle /> : <Info />}
                {t.text}
              </div>
            ))}
          </div>,
          document.body,
        )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  )
}

/** Dışarı tıklayınca kapanan açılır menü */
export function Popover({ trigger, children, align = 'right' }: { trigger: (open: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {trigger(() => setOpen((o) => !o))}
      {open && <div className="menu" style={{ top: 'calc(100% + 6px)', [align]: 0 }}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const h = () => setM(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [q])
  return m
}
export const useIsMobile = () => useMediaQuery('(max-width: 768px)')
