import type { CommissionCtx } from '../domain/commission'
import type { Repos } from './repos'

/** Hizmet → kategori ve ürün → marka çözümleyicisi (prim hesabı için). */
export function commissionCtx(repos: Repos): CommissionCtx {
  const cat = new Map(repos.services.list().map((s) => [s.id, s.categoryId]))
  const brand = new Map(repos.products.list().map((p) => [p.id, p.brand]))
  const svcPrice = new Map(repos.services.list().map((s) => [s.id, s.price]))
  /** Paket fiyatı, hizmetlerin liste değerine göre paylaştırılır; her pay o hizmetin toplam kullanımına (ücretli + hediye) bölünür. */
  const packageUseValue = (cpId: string, serviceId: string) => {
    const cp = repos.customerPackages.get(cpId)
    const def = cp ? repos.packageDefs.get(cp.packageDefId) : undefined
    const item = def?.items.find((i) => i.serviceId === serviceId)
    if (!def || !item) return 0
    const listTotal = def.items.reduce((s, i) => s + (svcPrice.get(i.serviceId) ?? 0) * i.count, 0)
    const share = listTotal ? (def.price * (svcPrice.get(serviceId) ?? 0) * item.count) / listTotal : def.price / def.items.length
    return Math.round(share / (item.count + (item.bonus ?? 0)))
  }
  return { categoryOf: (id) => cat.get(id), brandOf: (id) => brand.get(id), packageUseValue }
}
