/**
 * Enforces that composite and feature components use the Shadcn UI primitives
 * instead of raw HTML equivalents.
 *
 * Rules:
 *   - No bare <button in components/composites/ or components/features/
 *     (use Button from @/components/ui/button)
 *   - No bare <input in those dirs
 *     (use Input from @/components/ui/input)
 *   - No bare <label in those dirs
 *     (use Label from @/components/ui/label)
 *
 * Exceptions (allowlist):
 *   - <input type="radio"   → radios have no Shadcn primitive, raw is acceptable
 *   - <input type="file"    → file inputs have no Shadcn primitive
 *   - <input type="checkbox"→ no Shadcn primitive
 *   - .stories.tsx files    → render helpers may use raw elements
 *
 * Run: node scripts/check-primitives.mjs
 * Exit 1 on any violation.
 */

import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, relative } from 'path'

const ROOT = process.cwd()
const SCOPED_DIRS = ['components/composites', 'components/features']

function walk(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) results.push(...walk(full))
    else results.push(full)
  }
  return results
}

// Lines that contain a raw element but are explicitly allowed
function isAllowedRawInput(line) {
  return (
    /type=["']radio["']/.test(line) ||
    /type=["']file["']/.test(line) ||
    /type=["']checkbox["']/.test(line) ||
    /type=["']hidden["']/.test(line)
  )
}

const RULES = [
  {
    pattern: /<button[\s>]/,
    allow: () => false,
    message: (file, line, n) =>
      `RAW <button> at ${file}:${n} — use <Button> from @/components/ui/button`,
  },
  {
    pattern: /<input[\s>]/,
    allow: isAllowedRawInput,
    message: (file, line, n) =>
      `RAW <input> at ${file}:${n} — use <Input> from @/components/ui/input`,
  },
  {
    pattern: /<label[\s>]/,
    allow: () => false,
    message: (file, line, n) =>
      `RAW <label> at ${file}:${n} — use <Label> from @/components/ui/label`,
  },
]

let errors = []

for (const scopeDir of SCOPED_DIRS) {
  const absDir = join(ROOT, scopeDir)
  if (!existsSync(absDir)) continue

  const files = walk(absDir).filter(
    f => f.endsWith('.tsx') && !f.endsWith('.stories.tsx')
  )

  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const lines = src.split('\n')
    const rel = relative(ROOT, file)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue

      for (const rule of RULES) {
        if (rule.pattern.test(line) && !rule.allow(line)) {
          errors.push(rule.message(rel, line.trim(), i + 1))
        }
      }
    }
  }
}

if (errors.length) {
  console.error('\n✗  Primitive violations (must fix):')
  for (const e of errors) console.error(`   ${e}`)
  process.exit(1)
}

console.log('✓  All composite/feature components use Shadcn primitives.')
