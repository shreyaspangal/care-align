/**
 * Enforces Zod schema validation at both layers:
 *
 * SERVER (actions/):
 *   - Any 'use server' file that calls formData.get() must import from
 *     @/lib/validation/schemas and call .safeParse(), or delegate to a
 *     schema-backed validator like validateDocumentFile().
 *
 * CLIENT (components/):
 *   - Any 'use client' component that has a <form and imports a server action
 *     must also import from @/lib/validation/schemas and call .safeParse()
 *     for inline field validation before the server round-trip.
 *
 * LOGGING:
 *   - Server-side files must not use raw console.* — use createLogger().
 *
 * Run: node scripts/check-schemas.mjs
 * Exit 1 on any violation.
 */

import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, relative } from 'path'

const ROOT = process.cwd()
const ACTIONS_DIR = join(ROOT, 'actions')
const COMPONENTS_DIR = join(ROOT, 'components')
const APP_DIR = join(ROOT, 'app')

function walk(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) results.push(...walk(full))
    else results.push(full)
  }
  return results
}

let errors = []
let warnings = []

// ─── Server Actions ───────────────────────────────────────────────────────────

if (existsSync(ACTIONS_DIR)) {
  const serverFiles = walk(ACTIONS_DIR).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))

  for (const file of serverFiles) {
    const src = readFileSync(file, 'utf8')
    const rel = relative(ROOT, file)

    if (!src.includes("'use server'") && !src.includes('"use server"')) continue

    const usesFormData = src.includes('formData.get(')
    if (!usesFormData) continue

    const importsSchemas = src.includes('@/lib/validation/schemas')
    const usesSafeParse = src.includes('.safeParse(')
    // validateDocumentFile wraps DocumentFileSchema internally — counts as validated
    const usesSchemaValidator = src.includes('validateDocumentFile(')

    if (!importsSchemas && !usesSchemaValidator) {
      errors.push(
        `[server] NO SCHEMA: ${rel} — calls formData.get() without @/lib/validation/schemas or a schema-backed validator`
      )
    } else if (importsSchemas && !usesSafeParse) {
      errors.push(
        `[server] NO SAFE PARSE: ${rel} — imports schemas but never calls .safeParse()`
      )
    }
  }
}

// ─── Client Form Components — full contract check ────────────────────────────
//
// A client form that calls a server action must follow the complete form
// handling contract documented in CLAUDE.md § 3b. All 7 rules are checked.

const clientDirs = [COMPONENTS_DIR, APP_DIR].filter(existsSync)
const clientFiles = clientDirs
  .flatMap(d => walk(d))
  .filter(f => f.endsWith('.tsx') && !f.endsWith('.stories.tsx'))

for (const file of clientFiles) {
  const src = readFileSync(file, 'utf8')
  const rel = relative(ROOT, file)

  // Scope: 'use client' + <form + imports @/actions/
  if (!src.includes("'use client'") && !src.includes('"use client"')) continue
  if (!src.includes('<form')) continue
  if (!src.includes('@/actions/')) continue

  const violations = []

  // Rule 1 — imports matching schema from @/lib/validation/schemas
  if (!src.includes('@/lib/validation/schemas')) {
    violations.push('missing schema import from @/lib/validation/schemas')
  }

  // Rule 2 — calls .safeParse() client-side
  if (!src.includes('.safeParse(')) {
    violations.push('missing .safeParse() call for client-side validation')
  }

  // Rule 3 — onSubmit handler present on the form
  if (!src.includes('onSubmit')) {
    violations.push('missing onSubmit handler — safeParse must run before the action fires')
  }

  // Rule 4 — calls e.preventDefault() inside the submit handler
  if (!src.includes('preventDefault')) {
    violations.push('missing e.preventDefault() — invalid submits must not reach the server')
  }

  // Rule 5 — field-level error state (fieldErrors pattern)
  if (!src.includes('fieldErrors')) {
    violations.push('missing fieldErrors state — errors must be per-field, not a single top-level string')
  }

  // Rule 6 — aria-invalid wired to field error state
  if (!src.includes('aria-invalid')) {
    violations.push('missing aria-invalid on inputs — required for a11y and Shadcn error ring styles')
  }

  // Rule 7 — field errors clear on change (not just on full reset)
  // Heuristic: look for setFieldErrors inside an onChange handler
  if (!src.includes('setFieldErrors')) {
    violations.push('missing setFieldErrors — field errors must clear as the user edits that field')
  }

  if (violations.length > 0) {
    for (const v of violations) {
      errors.push(`[client] FORM CONTRACT: ${rel} — ${v}`)
    }
  }
}

// ─── Logging — no raw console.* in server-side files ────────────────────────

const allServerSideFiles = [
  ...(existsSync(ACTIONS_DIR) ? walk(ACTIONS_DIR) : []),
  ...(existsSync(join(ROOT, 'lib')) ? walk(join(ROOT, 'lib')) : []),
].filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('logger.ts'))

for (const file of allServerSideFiles) {
  const src = readFileSync(file, 'utf8')
  const rel = relative(ROOT, file)

  const isServerSide =
    src.includes("'use server'") ||
    src.includes('"use server"') ||
    src.includes("'server-only'") ||
    src.includes('"server-only"')
  if (!isServerSide) continue

  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue
    if (/console\.(log|warn|error|debug|info)\(/.test(line)) {
      warnings.push(
        `[logging] RAW CONSOLE: ${rel}:${i + 1} — use createLogger() from @/lib/logger`
      )
    }
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

if (warnings.length) {
  console.warn('\n⚠  Warnings:')
  for (const w of warnings) console.warn(`   ${w}`)
}

if (errors.length) {
  console.error('\n✗  Schema violations (must fix):')
  for (const e of errors) console.error(`   ${e}`)
  process.exit(1)
}

console.log('✓  All server actions and client forms use Zod schema validation.')
