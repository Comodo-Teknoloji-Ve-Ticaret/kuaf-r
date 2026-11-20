import type {
  Appointment, Branch, Customer, CustomerPackage, DayClose, DebtCollection, Expense, MessageLog, MessageTemplate,
  PackageDef, Product, Service, ServiceCategory, Staff, StockMove, Tenant, Ticket, TimeBlock, User,
} from '../domain/types'

export const DB_VERSION = 1

export interface DB {
  version: number
  seededFor?: string
  tenants: Tenant[]
  branches: Branch[]
  users: User[]
  staff: Staff[]
  categories: ServiceCategory[]
  services: Service[]
  customers: Customer[]
  appointments: Appointment[]
  blocks: TimeBlock[]
  tickets: Ticket[]
  debtCollections: DebtCollection[]
  expenses: Expense[]
  dayCloses: DayClose[]
  products: Product[]
  stockMoves: StockMove[]
  packageDefs: PackageDef[]
  customerPackages: CustomerPackage[]
  templates: MessageTemplate[]
  messages: MessageLog[]
}

export type CollectionKey = Exclude<keyof DB, 'version' | 'seededFor'>

export interface Store {
  read(): DB
  write(db: DB): void
  subscribe(fn: () => void): () => void
  reset(): void
  readonly recovered: boolean
  readonly persistError: boolean
}

export const newId = (prefix = '') => prefix + Math.random().toString(36).slice(2, 10)
