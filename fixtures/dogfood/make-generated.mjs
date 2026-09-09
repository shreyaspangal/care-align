// Renders each fixtures/dogfood/generated/<type>/source.txt into source.pdf,
// same hand-rolled PDF writer as eval/make-fixtures.mjs (see that file's
// header comment for why). These are dogfood fixtures, not scored eval
// cases — no expected.json, just something to run through capture/organize
// by hand while a real family document set is still being assembled.
//
// Re-run with `node fixtures/dogfood/make-generated.mjs` after editing any
// source.txt.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const genDir = path.join(import.meta.dirname, 'generated')

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 56
const FONT_SIZE = 11
const LEADING = 15

function pdfEscape(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function contentStream(lines) {
  const body = lines
    .map((line) => `(${pdfEscape(line.replace(/[^\x20-\x7E]/g, '?'))}) Tj T*`)
    .join('\n')
  return [
    'BT',
    `/F1 ${FONT_SIZE} Tf`,
    `${LEADING} TL`,
    `${MARGIN} ${PAGE_HEIGHT - MARGIN} Td`,
    body,
    'ET',
  ].join('\n')
}

function buildPdf(lines) {
  const stream = contentStream(lines)
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'latin1')
}

let written = 0
for (const entry of readdirSync(genDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const sourceText = path.join(genDir, entry.name, 'source.txt')
  if (!existsSync(sourceText)) continue
  const lines = readFileSync(sourceText, 'utf8').replace(/\n$/, '').split('\n')
  const target = path.join(genDir, entry.name, 'source.pdf')
  writeFileSync(target, buildPdf(lines))
  console.log(`wrote ${path.relative(process.cwd(), target)} (${lines.length} lines)`)
  written += 1
}
console.log(`${written} dogfood fixture PDF(s) generated`)
