/** Türk telefonlarını 10 haneli (5321112233) biçime indirger; geçersizse null. */
export function normalizePhone(raw: string): string | null {
  let d = (raw ?? '').replace(/\D/g, '')
  if (d.startsWith('90') && d.length === 12) d = d.slice(2)
  if (d.startsWith('0') && d.length === 11) d = d.slice(1)
  return /^[2-5]\d{9}$/.test(d) ? d : null
}

export function formatPhone(n: string): string {
  const d = normalizePhone(n) ?? n
  if (d.length !== 10) return n
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`
}

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/90${normalizePhone(phone) ?? phone}?text=${encodeURIComponent(text)}`
}
