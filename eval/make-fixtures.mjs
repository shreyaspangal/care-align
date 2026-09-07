// Renders each eval case's `source.txt` into a `source.pdf` the organize
// pipeline can actually be fed.
//
// Why hand-rolled: the repo has no image or PDF library, and adding one for
// three synthetic fixtures would owe a DECISIONS.md entry (Hard Rule 14) for a
// dependency that exists only to draw placeholder text. A PDF with one page,
// one base-14 font and one uncompressed content stream is a documented, stable
// ~80 lines — cheaper than the dependency and its upgrade surface.
//
// The committed `source.pdf` files are the fixtures; this script exists so the
// text is editable as text and the binaries are reproducible. Re-run with
// `node eval/make-fixtures.mjs` after editing any `source.txt`.
//
// Scope: ASCII, one page, no wrapping. Keep fixture lines short. Real
// founder-supplied documents will be photos/scans and will not go through here.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const casesDir = path.join(import.meta.dirname, 'cases')

const PAGE_WIDTH = 595 // A4 at 72dpi
const PAGE_HEIGHT = 842
const MARGIN = 56
const FONT_SIZE = 11
const LEADING = 15

/** PDF string literals escape backslash and both parens. */
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
for (const entry of readdirSync(casesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const sourceText = path.join(casesDir, entry.name, 'source.txt')
  if (!existsSync(sourceText)) continue
  const lines = readFileSync(sourceText, 'utf8').replace(/\n$/, '').split('\n')
  const target = path.join(casesDir, entry.name, 'source.pdf')
  writeFileSync(target, buildPdf(lines))
  console.log(`wrote ${path.relative(process.cwd(), target)} (${lines.length} lines)`)
  written += 1
}
console.log(`${written} fixture PDF(s) generated`)
