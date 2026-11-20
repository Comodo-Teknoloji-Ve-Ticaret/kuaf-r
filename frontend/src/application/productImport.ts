import type { ID, Product } from '../domain/types'
import type { Repos } from './repos'
import { stockService } from './stockService'

/** Excel/CSV satırlarından toplu ürün ekleme/güncelleme. Fiyatlar kuruş, KDV hariç saklanır. */
export type ImportField = 'name' | 'brand' | 'category' | 'barcode' | 'cost' | 'price' | 'vatRate' | 'stock' | 'critical' | 'kind'
export type ColumnMap = Partial<Record<ImportField, number>>

export const FIELD_LABEL: Record<ImportField, string> = {
  name: 'Ürün adı', brand: 'Marka', category: 'Kategori', barcode: 'Barkod', cost: 'Alış fiyatı', price: 'Satış fiyatı',
  vatRate: 'KDV', stock: 'Stok', critical: 'Kritik seviye', kind: 'Tür',
}

// Sıra önemli: "Alış Fiyatı" önce alışa, "Fiyat (KDV dahil)" önce satışa düşer.
const PATTERNS: [ImportField, RegExp][] = [
  ['barcode', /barkod|barcode|ean|gtin/],
  ['cost', /alış|alis|maliyet|cost|purchase/],
  ['price', /satış|satis|fiyat|price|tutar/],
  ['vatRate', /kdv|vat|tax|vergi/],
  ['stock', /stok|adet|miktar|qty|quantity|stock/],
  ['critical', /kritik|minimum|min\b/],
  ['kind', /tür|tur\b|tip|type|kullanım/],
  ['brand', /marka|brand|üretici/],
  ['category', /kategori|grup|category|cins/],
  ['name', /ürün|urun|\bad\b|adı|isim|name|product|açıklama/],
]

export function detectColumns(header: string[]): ColumnMap {
  const map: ColumnMap = {}
  header.forEach((h, i) => {
    const t = h.toLocaleLowerCase('tr').trim()
    const hit = PATTERNS.find(([f, re]) => map[f] === undefined && re.test(t))
    if (hit) map[hit[0]] = i
  })
  return map
}

/** "1.250,50", "1,250.50", "₺450 TL", "%20" → sayı; boş/okunamayan → null */
export function parseNumber(s: string): number | null {
  let t = String(s ?? '').replace(/[^\d.,-]/g, '')
  if (!/\d/.test(t)) return null
  const lastC = t.lastIndexOf(','), lastD = t.lastIndexOf('.')
  if (lastC >= 0 && lastD >= 0) t = lastC > lastD ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  else if (lastC >= 0) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export interface ImportItem {
  row: number
  status: 'new' | 'update'
  existingId?: ID
  product: Partial<Omit<Product, 'id' | 'tenantId' | 'stock'>> & { name: string }
  stock: number | null
}
export interface ImportPlan { items: ImportItem[]; errors: { row: number; message: string }[] }
export interface ImportOptions { costIncludesVat: boolean; priceIncludesVat: boolean; defaultVat: number }

/** Başlığında "KDV dahil" yazan fiyat sütunları için ön seçim. */
export function vatIncludedHint(header: string[], map: ColumnMap): { cost: boolean; price: boolean } {
  const incl = (i?: number) => i !== undefined && /dahil|incl/.test((header[i] ?? '').toLocaleLowerCase('tr'))
  return { cost: incl(map.cost), price: incl(map.price) }
}

const key = (s: string) => s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim()

export function planImport(repos: Repos, rows: string[][], map: ColumnMap, opts: ImportOptions): ImportPlan {
  const existing = repos.products.list()
  const items: ImportItem[] = []
  const errors: ImportPlan['errors'] = []
  const seen = new Map<string, number>()

  rows.slice(1).forEach((r, i) => {
    const row = i + 2
    const cell = (f: ImportField) => (map[f] === undefined ? '' : String(r[map[f]!] ?? '').trim())
    if (r.every((c) => String(c ?? '').trim() === '')) return
    const name = cell('name')
    if (!name) { errors.push({ row, message: 'Ürün adı boş' }); return }

    const nums: Partial<Record<ImportField, number | null>> = {}
    for (const f of ['cost', 'price', 'vatRate', 'stock', 'critical'] as const) {
      const raw = cell(f)
      if (!raw) continue
      const n = parseNumber(raw)
      if (n === null) { errors.push({ row, message: `${FIELD_LABEL[f]} okunamadı: "${raw}"` }); return }
      nums[f] = n
    }

    const barcode = cell('barcode')
    const brandIn = cell('brand'), catIn = cell('category')
    const match = (barcode && existing.find((p) => p.barcode === barcode))
      || existing.find((p) => key(p.name) === key(name) && key(p.brand) === key(brandIn || 'Markasız'))
    const isNew = !match

    const dupKey = barcode || `${key(name)}|${key(brandIn || 'Markasız')}`
    if (seen.has(dupKey)) { errors.push({ row, message: `Dosyada tekrar eden ürün (satır ${seen.get(dupKey)})` }); return }
    seen.set(dupKey, row)

    let vat = nums.vatRate ?? (match ? match.vatRate : opts.defaultVat)
    if (vat > 0 && vat <= 1) vat = vat * 100
    vat = Math.round(vat)
    const money = (n: number, incl: boolean) => {
      const k = Math.round(n * 100)
      return incl ? Math.round(k / (1 + vat / 100)) : k
    }
    const kindRaw = key(cell('kind'))
    const kind: Product['kind'] | undefined = !kindRaw ? undefined : /salon|profes|kullan|sarf/.test(kindRaw) ? 'professional' : 'retail'

    const product: ImportItem['product'] = { name }
    if (brandIn || isNew) product.brand = brandIn || 'Markasız'
    if (catIn || isNew) product.category = catIn || 'Genel'
    if (barcode) product.barcode = barcode
    if (nums.cost != null || isNew) product.cost = money(nums.cost ?? 0, opts.costIncludesVat)
    if (nums.price != null || isNew) product.price = money(nums.price ?? 0, opts.priceIncludesVat)
    if (nums.vatRate != null || isNew) product.vatRate = vat
    if (nums.critical != null) product.critical = Math.max(0, Math.round(nums.critical))
    if (kind || isNew) product.kind = kind ?? 'retail'

    items.push({ row, status: isNew ? 'new' : 'update', existingId: match?.id, product, stock: nums.stock != null ? Math.max(0, Math.round(nums.stock)) : null })
  })
  return { items, errors }
}

export function importProducts(repos: Repos, items: ImportItem[]): { created: number; updated: number } {
  const stock = stockService(repos)
  let created = 0, updated = 0
  const brands: string[] = [], cats: string[] = []
  for (const it of items) {
    if (it.status === 'update' && it.existingId) {
      const cur = repos.products.get(it.existingId)
      if (!cur) continue
      const saved = repos.products.upsert({ ...cur, ...it.product })
      if (it.stock !== null) stock.count(saved.id, it.stock, 'Excel içe aktarma')
      brands.push(saved.brand); cats.push(saved.category)
      updated++
    } else {
      const saved = repos.products.upsert({ brand: 'Markasız', category: 'Genel', kind: 'retail', price: 0, cost: 0, vatRate: 20, critical: 3, ...it.product, stock: 0 })
      if (it.stock) stock.receive(saved.id, it.stock, 'Excel içe aktarma')
      brands.push(saved.brand); cats.push(saved.category)
      created++
    }
  }
  const tenant = repos.tenantId ? repos.tenants.get(repos.tenantId) : undefined
  if (tenant) {
    const merge = (list: string[], add: string[]) => add.reduce((acc, v) => (acc.some((x) => key(x) === key(v)) ? acc : [...acc, v]), list)
    repos.tenants.upsert({ ...tenant, brands: merge(tenant.brands, brands), productCategories: merge(tenant.productCategories, cats) })
  }
  return { created, updated }
}
