/**
 * Bağımlılıksız tablo okuyucu: Excel (.xlsx) ve CSV.
 * .xlsx bir zip arşividir; ilk çalışma sayfası ve paylaşılan metinler okunur,
 * sıkıştırma tarayıcının yerleşik DecompressionStream('deflate-raw') ile açılır.
 */
export type Rows = string[][]

export async function readSheet(buf: ArrayBuffer, fileName: string): Promise<Rows> {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'xlsx') return readXlsx(buf)
  if (ext === 'csv' || ext === 'txt') return parseCsv(new TextDecoder('utf-8').decode(buf))
  if (ext === 'xls') throw new Error('Eski .xls biçimi desteklenmiyor. Excel\'de "Farklı kaydet → Excel Çalışma Kitabı (.xlsx)" ile kaydedip tekrar deneyin.')
  throw new Error('Desteklenmeyen dosya. Lütfen Excel (.xlsx) ya da CSV dosyası seçin.')
}

// ---------- CSV ----------
export function parseCsv(text: string): Rows {
  text = text.replace(/^﻿/, '')
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delim = [';', '\t', ','].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const rows: Rows = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === delim) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// ---------- XLSX ----------
async function readXlsx(buf: ArrayBuffer): Promise<Rows> {
  const files = unzipIndex(buf)
  const sheetName = files.has('xl/worksheets/sheet1.xml') ? 'xl/worksheets/sheet1.xml' : [...files.keys()].filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0]
  if (!sheetName) throw new Error('Excel dosyasında sayfa bulunamadı.')
  const shared = files.has('xl/sharedStrings.xml') ? parseShared(await extract(buf, files.get('xl/sharedStrings.xml')!)) : []
  return parseSheet(await extract(buf, files.get(sheetName)!), shared)
}

interface Entry { method: number; compSize: number; offset: number }

function unzipIndex(buf: ArrayBuffer): Map<string, Entry> {
  const v = new DataView(buf)
  let eocd = -1
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('Dosya okunamadı: geçerli bir Excel (.xlsx) dosyası değil.')
  const count = v.getUint16(eocd + 10, true)
  let p = v.getUint32(eocd + 16, true)
  const dec = new TextDecoder()
  const out = new Map<string, Entry>()
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break
    const method = v.getUint16(p + 10, true)
    const compSize = v.getUint32(p + 20, true)
    const nLen = v.getUint16(p + 28, true), xLen = v.getUint16(p + 30, true), cLen = v.getUint16(p + 32, true)
    const offset = v.getUint32(p + 42, true)
    out.set(dec.decode(new Uint8Array(buf, p + 46, nLen)), { method, compSize, offset })
    p += 46 + nLen + xLen + cLen
  }
  return out
}

async function extract(buf: ArrayBuffer, e: Entry): Promise<string> {
  const v = new DataView(buf)
  const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true)
  const data = new Uint8Array(buf, start, e.compSize)
  if (e.method === 0) return new TextDecoder().decode(data)
  if (e.method !== 8) throw new Error('Excel dosyası desteklenmeyen biçimde sıkıştırılmış.')
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
}

const unescape = (s: string) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join('')

function parseShared(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1].replace(/<rPh[\s\S]*?<\/rPh>/g, '')))
}

const colIndex = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1

function parseSheet(xml: string, shared: string[]): Rows {
  const rows: Rows = []
  for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rIdx = Number(/\br="(\d+)"/.exec(rm[1])?.[1] ?? rows.length + 1) - 1
    const row: string[] = []
    let next = 0
    for (const cm of (rm[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], body = cm[2] ?? ''
      const ref = /\br="([A-Z]+\d*)"/.exec(attrs)?.[1]
      const ci = ref ? colIndex(ref) : next
      next = ci + 1
      const t = /\bt="(\w+)"/.exec(attrs)?.[1]
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
      const val = t === 's' ? shared[Number(raw)] ?? '' : t === 'inlineStr' ? texts(body) : raw !== undefined ? unescape(raw) : ''
      while (row.length < ci) row.push('')
      row[ci] = val
    }
    while (row.length && row[row.length - 1] === '') row.pop()
    if (row.length) rows[rIdx] = row
  }
  return rows.filter(Boolean)
}
