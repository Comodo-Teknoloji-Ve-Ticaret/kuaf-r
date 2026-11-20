/** {degisken} biçimli şablonu doldurur; bilinmeyen değişkenler olduğu gibi kalır. */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{([a-zçğıöşü_]+)\}/gi, (m, k: string) => (k in vars ? vars[k] : m))
}

export const TEMPLATE_VARS: { key: string; label: string }[] = [
  { key: 'musteri', label: 'Müşteri adı' },
  { key: 'salon', label: 'Salon adı' },
  { key: 'tarih', label: 'Tarih' },
  { key: 'saat', label: 'Saat' },
  { key: 'hizmet', label: 'Hizmet' },
  { key: 'personel', label: 'Personel' },
]
