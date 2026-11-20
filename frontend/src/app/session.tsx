import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Branch, Tenant, User } from '../domain/types'
import { tenantAccess } from '../application/platformService'
import { todayIstanbul } from '../domain/time'
import { TenantScope, useDbSnapshot } from '../infrastructure'
import { can, type Perm } from './permissions'

export type ThemePref = 'light' | 'dark' | 'system'
const KEY = 'makas:session'

interface Saved { userId: string | null; branchId: string | null; theme: ThemePref }

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '')
    return { userId: s.userId ?? null, branchId: s.branchId ?? null, theme: s.theme ?? 'light' }
  } catch {
    return { userId: null, branchId: null, theme: 'light' }
  }
}

export interface Session {
  user: User | null
  tenant: Tenant | null
  branches: Branch[]
  branch: Branch | null
  branchId: string | null
  setBranch: (id: string) => void
  login: (userId: string) => void
  logout: () => void
  theme: ThemePref
  setTheme: (t: ThemePref) => void
  can: (p: Perm) => boolean
}

const Ctx = createContext<Session | null>(null)

export function useSession(): Session {
  const s = useContext(Ctx)
  if (!s) throw new Error('SessionProvider eksik')
  return s
}

export function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121216' : '#6c5ce7')
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const db = useDbSnapshot()
  const [saved, setSaved] = useState<Saved>(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(saved))
  }, [saved])

  useEffect(() => {
    applyTheme(saved.theme)
    if (saved.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = () => applyTheme('system')
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [saved.theme])

  const user = db.users.find((u) => u.id === saved.userId) ?? null
  const tenant = user?.tenantId ? db.tenants.find((t) => t.id === user.tenantId) ?? null : null
  const suspended = tenant ? tenantAccess(tenant, todayIstanbul()) !== 'ok' : false
  const effectiveUser = suspended ? null : user

  const branches = useMemo(
    () => (tenant ? db.branches.filter((b) => b.tenantId === tenant.id && (effectiveUser?.branchIds.includes(b.id) ?? false)) : []),
    [db.branches, tenant, effectiveUser],
  )
  const branch = branches.find((b) => b.id === saved.branchId) ?? branches[0] ?? null

  const login = useCallback((userId: string) => {
    setSaved((s) => ({ ...s, userId, branchId: null }))
  }, [])
  const logout = useCallback(() => setSaved((s) => ({ ...s, userId: null, branchId: null })), [])

  const value: Session = {
    user: effectiveUser,
    tenant: suspended ? null : tenant,
    branches,
    branch,
    branchId: branch?.id ?? null,
    setBranch: (id) => setSaved((s) => ({ ...s, branchId: id })),
    login,
    logout,
    theme: saved.theme,
    setTheme: (theme) => setSaved((s) => ({ ...s, theme })),
    can: (p) => (effectiveUser ? can(effectiveUser.role, p) : false),
  }

  return (
    <Ctx.Provider value={value}>
      <TenantScope tenantId={effectiveUser?.tenantId ?? null}>{children}</TenantScope>
    </Ctx.Provider>
  )
}

export const isSuspendedLogin = (db: { users: User[]; tenants: Tenant[] }, userId: string, today = todayIstanbul()) => {
  const u = db.users.find((x) => x.id === userId)
  const t = u?.tenantId ? db.tenants.find((x) => x.id === u.tenantId) : undefined
  return !!t && tenantAccess(t, today) !== 'ok'
}
