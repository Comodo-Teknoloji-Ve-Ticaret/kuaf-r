import type { CommissionCtx } from '../domain/commission'
import type { Repos } from './repos'

/** Hizmet → kategori ve ürün → marka çözümleyicisi (prim hesabı için). */
export function commissionCtx(repos: Repos): CommissionCtx {
  const cat = new Map(repos.services.list().map((s) => [s.id, s.categoryId]))
  const brand = new Map(repos.products.list().map((p) => [p.id, p.brand]))
  return { categoryOf: (id) => cat.get(id), brandOf: (id) => brand.get(id) }
}
