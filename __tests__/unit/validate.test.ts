import { describe, it, expect } from 'vitest'
import { validateDocumentFile, MAX_SIZE_BYTES } from '@/lib/storage/validate'

function makeFile(name: string, type: string, size: number): File {
  const blob = new Blob([new Uint8Array(size)], { type })
  return new File([blob], name, { type })
}

describe('validateDocumentFile', () => {
  it('accepts a valid PDF', () => {
    const result = validateDocumentFile(makeFile('report.pdf', 'application/pdf', 1024))
    expect(result.ok).toBe(true)
  })

  it('accepts a valid JPEG', () => {
    const result = validateDocumentFile(makeFile('photo.jpg', 'image/jpeg', 1024))
    expect(result.ok).toBe(true)
  })

  it('accepts a valid PNG', () => {
    const result = validateDocumentFile(makeFile('scan.png', 'image/png', 1024))
    expect(result.ok).toBe(true)
  })

  it('accepts a valid HEIC', () => {
    const result = validateDocumentFile(makeFile('photo.heic', 'image/heic', 1024))
    expect(result.ok).toBe(true)
  })

  it('rejects an unsupported MIME type', () => {
    const result = validateDocumentFile(makeFile('data.csv', 'text/csv', 1024))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not supported/i)
  })

  it('rejects a file over 10 MB', () => {
    const result = validateDocumentFile(makeFile('big.pdf', 'application/pdf', MAX_SIZE_BYTES + 1))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/too large/i)
  })

  it('rejects an empty file', () => {
    const result = validateDocumentFile(makeFile('empty.pdf', 'application/pdf', 0))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/empty/i)
  })

  it('accepts a file exactly at the size limit', () => {
    const result = validateDocumentFile(makeFile('max.pdf', 'application/pdf', MAX_SIZE_BYTES))
    expect(result.ok).toBe(true)
  })
})
