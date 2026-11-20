import { describe, expect, it } from 'vitest'
import { detectColumns, importProducts, parseNumber, planImport, vatIncludedHint } from './productImport'
import { setup } from './testkit'

const header = ['Ürün Adı', 'Marka', 'Kategori', 'Barkod', 'Alış Fiyatı', 'Satış Fiyatı', 'KDV', 'Stok', 'Tür']

describe('parseNumber', () => {
  it.each([
    ['1.250,50', 1250.5], ['1250,5', 1250.5], ['1,250.50', 1250.5], ['12.5', 12.5], ['1.250', 1250], ['₺ 450 TL', 450], ['%20', 20], ['', null], ['abc', null], ['450', 450],
  ])('%s → %s', (s, n) => expect(parseNumber(s)).toBe(n))
})

describe('detectColumns', () => {
  it('maps Turkish and English headers', () => {
    expect(detectColumns(header)).toEqual({ name: 0, brand: 1, category: 2, barcode: 3, cost: 4, price: 5, vatRate: 6, stock: 7, kind: 8 })
    expect(detectColumns(['Product', 'Brand', 'Price', 'Qty'])).toMatchObject({ name: 0, brand: 1, price: 2, stock: 3 })
    expect(detectColumns(['Ürün', 'Fiyat (KDV Dahil)', 'Maliyet'])).toMatchObject({ name: 0, price: 1, cost: 2 })
  })
})

describe('planImport', () => {
  const rows = [header,
    ['Onarıcı Şampuan', 'Loreal', 'Şampuan', '869000', '200', '360', '%20', '12', 'Satış'],
    ['Oksidan 6%', 'Wella', 'Boya', '', '150,00', '', '0,2', '5', 'Salon kullanımı'],
    ['', 'X', '', '', '', '', '', '', ''],
    ['Bozuk', 'Y', 'Z', '', 'abc', '', '', '', ''],
  ]
  it('builds items in kuruş, VAT excluded, with defaults and row errors', () => {
    const r = setup()
    const p = planImport(r, rows, detectColumns(header), { costIncludesVat: false, priceIncludesVat: false, defaultVat: 20 })
    expect(p.items).toHaveLength(2)
    expect(p.items[0]).toMatchObject({ row: 2, status: 'new', product: { name: 'Onarıcı Şampuan', brand: 'Loreal', category: 'Şampuan', barcode: '869000', cost: 20000, price: 36000, vatRate: 20, kind: 'retail' }, stock: 12 })
    expect(p.items[1].product).toMatchObject({ kind: 'professional', vatRate: 20, cost: 15000, price: 0 })
    expect(p.errors).toEqual([{ row: 4, message: 'Ürün adı boş' }, { row: 5, message: 'Alış fiyatı okunamadı: "abc"' }])
  })
  it('converts VAT-included prices to excluded, separately for cost and sale', () => {
    const rows = [['Ürün', 'Alış', 'Fiyat', 'KDV'], ['A', '100', '120', '20']]
    const m = { name: 0, cost: 1, price: 2, vatRate: 3 }
    expect(planImport(setup(), rows, m, { costIncludesVat: false, priceIncludesVat: true, defaultVat: 20 }).items[0].product).toMatchObject({ cost: 10000, price: 10000 })
    expect(planImport(setup(), rows, m, { costIncludesVat: true, priceIncludesVat: false, defaultVat: 20 }).items[0].product).toMatchObject({ cost: 8333, price: 12000 })
  })
  it('vatIncludedHint reads "KDV dahil" per column header', () => {
    expect(vatIncludedHint(['Ürün', 'Alış Fiyatı', 'Satış Fiyatı (KDV Dahil)'], { name: 0, cost: 1, price: 2 })).toEqual({ cost: false, price: true })
    expect(vatIncludedHint(['Ürün', 'Alış (kdv dahil)', 'Satış'], { name: 0, cost: 1, price: 2 })).toEqual({ cost: true, price: false })
  })
  it('fills missing brand/category and marks existing products (barcode, then name+brand) for update', () => {
    const r = setup()
    r.products.upsert({ id: 'p1', name: 'Onarıcı Şampuan', brand: 'LOREAL', category: 'Şampuan', kind: 'retail', price: 1, cost: 1, vatRate: 20, stock: 3, critical: 2 })
    r.products.upsert({ id: 'p2', name: 'Eski ad', brand: 'Q', barcode: '111', category: 'K', kind: 'retail', price: 1, cost: 1, vatRate: 20, stock: 0, critical: 2 })
    const p = planImport(r, [['Ürün', 'Barkod'], ['onarıcı şampuan', ''], ['Yeni ad', '111'], ['Tek', '']], { name: 0, barcode: 1 }, { costIncludesVat: false, priceIncludesVat: false, defaultVat: 20 })
    expect(p.items.map((i) => [i.status, i.existingId])).toEqual([['new', undefined], ['update', 'p2'], ['new', undefined]])
    expect(p.items[0].product).toMatchObject({ brand: 'Markasız', category: 'Genel' })
  })
  it('flags duplicates inside the file', () => {
    const p = planImport(setup(), [['Ürün', 'Marka'], ['A', 'B'], ['a', 'b']], { name: 0, brand: 1 }, { costIncludesVat: false, priceIncludesVat: false, defaultVat: 20 })
    expect(p.items).toHaveLength(1)
    expect(p.errors).toEqual([{ row: 3, message: 'Dosyada tekrar eden ürün (satır 2)' }])
  })
})

describe('importProducts', () => {
  it('creates new products with opening stock, updates existing (stock set by count), registers brands/categories', () => {
    const r = setup()
    r.products.upsert({ id: 'p2', name: 'Eski', brand: 'Q', barcode: '111', category: 'K', kind: 'retail', price: 1, cost: 1, vatRate: 20, stock: 9, critical: 2 })
    const plan = planImport(r, [['Ürün', 'Marka', 'Kategori', 'Barkod', 'Satış', 'Stok'], ['Yeni', 'Wella', 'Boya', '', '100', '4'], ['Eski yeni ad', 'Q', 'K', '111', '50', '6'], ['Stoksuz', 'Wella', 'Boya', '', '', '']],
      { name: 0, brand: 1, category: 2, barcode: 3, price: 4, stock: 5 }, { costIncludesVat: false, priceIncludesVat: false, defaultVat: 20 })
    const res = importProducts(r, plan.items)
    expect(res).toEqual({ created: 2, updated: 1 })
    const yeni = r.products.list().find((p) => p.name === 'Yeni')!
    expect(yeni).toMatchObject({ stock: 4, price: 10000, critical: 3 })
    expect(r.stockMoves.list({ productId: yeni.id })[0]).toMatchObject({ qty: 4, kind: 'in' })
    expect(r.products.get('p2')).toMatchObject({ name: 'Eski yeni ad', price: 5000, stock: 6, critical: 2 })
    expect(r.products.list().find((p) => p.name === 'Stoksuz')!.stock).toBe(0)
    expect(r.tenants.get('t1')!.brands).toEqual(['Wella', 'Q'])
    expect(r.tenants.get('t1')!.productCategories).toEqual(['Boya', 'K'])
  })
})
