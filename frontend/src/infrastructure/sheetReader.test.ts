import { describe, expect, it } from 'vitest'
import { readSheet } from './sheetReader'

/** Minimal zip yazıcı (test için): her girdi deflate (8) ya da stored (0). */
async function deflateRaw(b: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([b as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
}

async function zip(files: Record<string, string>, method: 0 | 8 = 8): Promise<ArrayBuffer> {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text)
    const data = method === 8 ? await deflateRaw(raw) : raw
    const n = enc.encode(name)
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(8, method, true)
    lh.setUint32(18, data.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, n.length, true)
    const local = new Uint8Array([...new Uint8Array(lh.buffer), ...n, ...data])
    const ch = new DataView(new ArrayBuffer(46))
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(10, method, true)
    ch.setUint32(20, data.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, n.length, true); ch.setUint32(42, offset, true)
    centrals.push(new Uint8Array([...new Uint8Array(ch.buffer), ...n]))
    locals.push(local); offset += local.length
  }
  const cdSize = centrals.reduce((s, c) => s + c.length, 0)
  const eocd = new DataView(new ArrayBuffer(22))
  eocd.setUint32(0, 0x06054b50, true); eocd.setUint16(8, centrals.length, true); eocd.setUint16(10, centrals.length, true)
  eocd.setUint32(12, cdSize, true); eocd.setUint32(16, offset, true)
  const all = [...locals, ...centrals, new Uint8Array(eocd.buffer)]
  const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0))
  let p = 0; for (const a of all) { out.set(a, p); p += a.length }
  return out.buffer
}

const SHARED = '<sst><si><t>Ürün Adı</t></si><si><t>Marka</t></si><si><r><t>Şampuan </t></r><r><t>300 ml</t></r></si><si><t>L&amp;O</t></si></sst>'
const SHEET = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>Fiyat</t></is></c></row>' +
  '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c><c r="D2"><v>12.5</v></c></row><row r="4"><c r="A4" t="str"><v>Maske</v></c></row></sheetData></worksheet>'

describe('readSheet', () => {
  it('reads an xlsx: shared + rich + inline strings, numbers, gaps, entities', async () => {
    const rows = await readSheet(await zip({ 'xl/sharedStrings.xml': SHARED, 'xl/worksheets/sheet1.xml': SHEET }), 'urunler.xlsx')
    expect(rows).toEqual([
      ['Ürün Adı', 'Marka', 'Fiyat'],
      ['Şampuan 300 ml', 'L&O', '', '12.5'],
      ['Maske'],
    ])
  })
  it('reads stored (uncompressed) xlsx entries too', async () => {
    const rows = await readSheet(await zip({ 'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>X</t></is></c></row></sheetData></worksheet>' }, 0), 'a.xlsx')
    expect(rows).toEqual([['X']])
  })
  it('reads semicolon CSV (Turkish Excel) with quotes and BOM', async () => {
    const csv = '﻿Ürün;Fiyat\n"Krem; nemlendirici";"1.250,50"\r\nSprey;90\n'
    const rows = await readSheet(new TextEncoder().encode(csv).buffer, 'a.csv')
    expect(rows).toEqual([['Ürün', 'Fiyat'], ['Krem; nemlendirici', '1.250,50'], ['Sprey', '90']])
  })
  it('reads comma CSV', async () => {
    expect(await readSheet(new TextEncoder().encode('a,b\n"x ""y""",2').buffer, 'a.csv')).toEqual([['a', 'b'], ['x "y"', '2']])
  })
  it('rejects unsupported files with a Turkish message', async () => {
    await expect(readSheet(new ArrayBuffer(4), 'liste.pdf')).rejects.toThrow(/Excel/)
  })
})
