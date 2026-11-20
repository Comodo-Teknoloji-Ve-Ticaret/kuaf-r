// Makas domain modeli.
// Saatler: gün içi dakika (540 = 09:00). Tarihler: 'YYYY-MM-DD'. Tutarlar: kuruş (integer).

export type ID = string
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Pazar
export type DayHours = { open: number; close: number } | null
export type WeekHours = Record<Weekday, DayHours>

export interface OnlineBookingSettings {
  enabled: boolean
  requireApproval: boolean
  maxDaysAhead: number
  minLeadMinutes: number
}

export type BusinessType = 'kuafor' | 'berber' | 'guzellik' | 'dis' | 'spa' | 'tirnak' | 'diger'

export interface License {
  start: string // 'YYYY-MM-DD'
  days: number
}

export interface Tenant {
  id: ID
  name: string
  slug: string
  logoColor: string
  plan: 'baslangic' | 'pro' | 'kurumsal'
  status: 'active' | 'suspended'
  onlineBooking: OnlineBookingSettings
  createdAt: string
  businessType: BusinessType
  license: License
  invite?: { token: string; createdAt: string; usedAt?: string }
}

export interface Branch {
  id: ID
  tenantId: ID
  name: string
  address: string
  phone: string
  hours: WeekHours
}

export type Role = 'owner' | 'reception' | 'staff' | 'platform'

export interface User {
  id: ID
  tenantId: ID | null
  name: string
  role: Role
  staffId?: ID
  branchIds: ID[]
}

export interface Staff {
  id: ID
  tenantId: ID
  branchId: ID
  name: string
  title: string
  color: string
  phone: string
  hours: WeekHours
  serviceIds: ID[]
  serviceCommission: number // yüzde, 0-100
  productCommission: number
  active: boolean
}

export type CategoryKey = 'boya' | 'kesim' | 'bakim' | 'fon' | 'tirnak' | 'sakal' | 'diger'

export interface ServiceCategory {
  id: ID
  tenantId: ID
  name: string
  color: CategoryKey
  order: number
}

export interface Service {
  id: ID
  tenantId: ID
  categoryId: ID
  name: string
  duration: number
  price: number
  online: boolean
  overrides: Record<ID, { duration?: number; price?: number }>
}

export interface Customer {
  id: ID
  tenantId: ID
  name: string
  phone: string // normalize: 5321112233
  birthday?: string // 'MM-DD'
  gender?: 'k' | 'e'
  tags: string[]
  notes: string
  consentSms: boolean
  createdAt: string
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'in_service'
  | 'completed'
  | 'no_show'
  | 'cancelled'

export type AppointmentSource = 'reception' | 'online' | 'phone' | 'walkin'

export interface AppointmentItem {
  serviceId: ID
  price: number
  duration: number
}

export interface Appointment {
  id: ID
  tenantId: ID
  branchId: ID
  staffId: ID
  customerId: ID | null
  date: string
  start: number
  end: number
  items: AppointmentItem[]
  status: AppointmentStatus
  source: AppointmentSource
  note: string
  code: string
  recurrenceId?: ID
  createdAt: string
}

export interface TimeBlock {
  id: ID
  tenantId: ID
  staffId: ID
  date: string
  start: number
  end: number
  kind: 'break' | 'leave' | 'meeting'
  note: string
}

export interface Discount {
  type: 'percent' | 'amount'
  value: number // percent: 0-100, amount: kuruş
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'debt'

export interface Payment {
  method: PaymentMethod
  amount: number
}

export type TicketLineKind = 'service' | 'product' | 'package_sale' | 'package_use'

export interface TicketLine {
  id: ID
  kind: TicketLineKind
  refId: ID // service / product / packageDef / customerPackage
  name: string
  staffId?: ID
  qty: number
  unitPrice: number
  discount: Discount | null
  serviceId?: ID // package_use: düşülen hizmet
}

export interface Ticket {
  id: ID
  tenantId: ID
  branchId: ID
  date: string
  customerId: ID | null
  appointmentId?: ID
  lines: TicketLine[]
  discount: Discount | null
  tip: number
  tipStaffId?: ID
  payments: Payment[]
  status: 'open' | 'closed'
  createdAt: string
  closedAt?: string
}

export interface DebtCollection {
  id: ID
  tenantId: ID
  branchId: ID
  customerId: ID
  date: string
  amount: number
  method: Exclude<PaymentMethod, 'debt'>
}

export interface Expense {
  id: ID
  tenantId: ID
  branchId: ID
  date: string
  category: string
  amount: number
  method: Exclude<PaymentMethod, 'debt'>
  note: string
}

export interface DayClose {
  id: ID
  tenantId: ID
  branchId: ID
  date: string
  expectedCash: number
  countedCash: number
  note: string
  closedBy: ID
  locked: boolean
}

export interface Product {
  id: ID
  tenantId: ID
  name: string
  brand: string
  barcode?: string
  category: string
  kind: 'retail' | 'professional'
  price: number
  cost: number
  stock: number
  critical: number
}

export interface StockMove {
  id: ID
  tenantId: ID
  productId: ID
  date: string
  qty: number // + giriş, - çıkış
  kind: 'in' | 'sale' | 'use' | 'adjust'
  ticketId?: ID
  note: string
}

export interface PackageDef {
  id: ID
  tenantId: ID
  name: string
  items: { serviceId: ID; count: number }[]
  price: number
  validDays: number
  active: boolean
}

export interface CustomerPackage {
  id: ID
  tenantId: ID
  customerId: ID
  packageDefId: ID
  remaining: Record<ID, number>
  soldOn: string
  expiresOn: string
  ticketId?: ID
}

export type MessageKind = 'confirm' | 'reminder' | 'cancel' | 'birthday' | 'winback'

export interface MessageTemplate {
  id: ID
  tenantId: ID
  kind: MessageKind
  name: string
  body: string
  enabled: boolean
  hoursBefore?: number
}

export interface MessageLog {
  id: ID
  tenantId: ID
  customerId: ID | null
  appointmentId?: ID
  kind: MessageKind
  channel: 'sms' | 'whatsapp'
  to: string
  body: string
  status: 'simulated' | 'opened'
  at: string
}
