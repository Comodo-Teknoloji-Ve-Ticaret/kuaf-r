import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Login from '../pages/Login'
import { MorePage, Shell } from '../ui/Shell'
import type { Perm } from './permissions'
import { useSession } from './session'

const CalendarPage = lazy(() => import('../pages/calendar/CalendarPage'))
const CustomersPage = lazy(() => import('../pages/customers/CustomersPage'))
const CashPage = lazy(() => import('../pages/cash/CashPage'))
const ServicesPage = lazy(() => import('../pages/services/ServicesPage'))
const StaffPage = lazy(() => import('../pages/staff/StaffPage'))
const StockPage = lazy(() => import('../pages/stock/StockPage'))
const PackagesPage = lazy(() => import('../pages/packages/PackagesPage'))
const MessagesPage = lazy(() => import('../pages/messages/MessagesPage'))
const ReportsPage = lazy(() => import('../pages/reports/ReportsPage'))
const MyCommissionPage = lazy(() => import('../pages/staff/MyCommissionPage'))
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage'))
const PlatformPage = lazy(() => import('../pages/platform/PlatformPage'))
const BookingPage = lazy(() => import('../pages/booking/BookingPage'))

const Loading = () => <div className="page muted">Yükleniyor…</div>

function Guard({ perm, children }: { perm: Perm; children: ReactNode }) {
  const { user, can } = useSession()
  if (!user) return <Navigate to="/giris" replace />
  if (!can(perm)) return <Navigate to={user.role === 'platform' ? '/platform' : '/takvim'} replace />
  return <Shell><Suspense fallback={<Loading />}>{children}</Suspense></Shell>
}

function Home() {
  const { user } = useSession()
  if (!user) return <Navigate to="/giris" replace />
  return <Navigate to={user.role === 'platform' ? '/platform' : '/takvim'} replace />
}

export function AppRoutes() {
  const { user } = useSession()
  return (
    <Routes>
      <Route path="/giris" element={<Login />} />
      <Route path="/r/:slug" element={<Suspense fallback={<Loading />}><BookingPage /></Suspense>} />
      <Route path="/takvim" element={<Guard perm="calendar"><CalendarPage /></Guard>} />
      <Route path="/musteriler" element={<Guard perm="customers"><CustomersPage /></Guard>} />
      <Route path="/musteriler/:id" element={<Guard perm="customers"><CustomersPage /></Guard>} />
      <Route path="/kasa" element={<Guard perm="cash"><CashPage /></Guard>} />
      <Route path="/hizmetler" element={<Guard perm="services"><ServicesPage /></Guard>} />
      <Route path="/personel" element={<Guard perm="staff"><StaffPage /></Guard>} />
      <Route path="/stok" element={<Guard perm="stock"><StockPage /></Guard>} />
      <Route path="/paketler" element={<Guard perm="packages"><PackagesPage /></Guard>} />
      <Route path="/mesajlar" element={<Guard perm="messages"><MessagesPage /></Guard>} />
      <Route path="/raporlar" element={<Guard perm="reports"><ReportsPage /></Guard>} />
      <Route path="/primlerim" element={<Guard perm="commission.own"><MyCommissionPage /></Guard>} />
      <Route path="/ayarlar" element={<Guard perm="settings"><SettingsPage /></Guard>} />
      <Route path="/platform" element={<Guard perm="platform"><PlatformPage /></Guard>} />
      <Route path="/daha" element={user ? <Shell><MorePage /></Shell> : <Navigate to="/giris" replace />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
