import type { Role } from '../domain/types'

export type Perm =
  | 'calendar' | 'calendar.all' | 'customers' | 'cash' | 'services' | 'staff' | 'stock'
  | 'packages' | 'messages' | 'reports' | 'settings' | 'platform' | 'commission.own'

const MATRIX: Record<Role, Perm[]> = {
  owner: ['calendar', 'calendar.all', 'customers', 'cash', 'services', 'staff', 'stock', 'packages', 'messages', 'reports', 'settings', 'commission.own'],
  reception: ['calendar', 'calendar.all', 'customers', 'cash', 'services', 'stock', 'packages', 'messages'],
  staff: ['calendar', 'customers', 'commission.own'],
  platform: ['platform'],
}

export const can = (role: Role, perm: Perm) => MATRIX[role].includes(perm)

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Salon Sahibi',
  reception: 'Resepsiyon',
  staff: 'Personel',
  platform: 'Comodo Yönetici',
}
