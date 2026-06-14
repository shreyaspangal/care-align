/**
 * Enforces two type hygiene rules across the codebase:
 *
 * RULE 1 — No inline domain type redefinitions
 *   All DB-aligned union types (DocumentType, EpisodeStatus, TaskCategory, etc.)
 *   must be imported from @/lib/types/domain, never redefined inline.
 *   Scope: components/, actions/, app/, lib/ (excluding lib/types/domain.ts itself).
 *
 * RULE 2 — No deprecated AI SDK APIs
 *   generateObject is deprecated in ai@6+. Use generateText + Output.object({ schema }).
 *   Scope: lib/ai/, actions/.
 *
 * Run: node scripts/check-types.mjs
 * Exit 1 on any violation.
 */

import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, relative } from 'path'

const ROOT = process.cwd()

function walk(dir) {
  const results = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) results.push(...walk(full))
    else results.push(full)
  }
  return results
}

const errors = []

// ─── Rule 1: No inline domain type redefinitions ──────────────────────────────
//
// These types are owned by lib/types/domain.ts. Defining them inline anywhere
// else creates silent drift when the DB enum changes.

const DOMAIN_TYPES = [
  'DocumentType',
  'EpisodeStatus',
  'TranslationStatus',
  'DocumentStatus',
  'TaskCategory',
  'TaskPhase',
  'TaskStatus',
  'ActionFor',
  'UserRole',
  'AdmissionStatus',
]

// Pattern: `type Foo =` or `type Foo=` as a standalone declaration (not in an import)
const inlineTypePattern = new RegExp(
  `^\\s*(?:export\\s+)?type\\s+(${DOMAIN_TYPES.join('|')})\\s*=`,
  'm'
)

const typeCheckDirs = ['components', 'actions', 'app', 'lib'].map(d => join(ROOT, d))
const typeCheckFiles = typeCheckDirs
  .flatMap(walk)
  .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
  // Domain source and its derivation file are exempt; stories have no runtime impact
  .filter(f =>
    !f.includes('lib/types/domain.ts') &&
    !f.includes('lib/validation/schemas.ts') &&
    !f.endsWith('.stories.tsx')
  )

for (const file of typeCheckFiles) {
  const src = readFileSync(file, 'utf8')
  const rel = relative(ROOT, file)
  const match = src.match(inlineTypePattern)
  if (match) {
    errors.push(
      `[types] INLINE DOMAIN TYPE: ${rel} — '${match[1]}' must be imported from @/lib/types/domain, not redefined inline`
    )
  }
}

// ─── Rule 2: No deprecated AI SDK APIs ───────────────────────────────────────
//
// generateObject is @deprecated in ai@6+.
// Use: generateText + Output.object({ schema }) — result.output is the typed value.
// Error to catch: NoOutputGeneratedError (not NoObjectGeneratedError).

const DEPRECATED_AI_APIS = [
  { pattern: /\bimport\s+\{[^}]*\bgenerateObject\b/, label: 'generateObject (deprecated — use generateText + Output.object({ schema }))' },
  { pattern: /\bimport\s+\{[^}]*\bstreamObject\b/, label: 'streamObject (deprecated — use streamText + Output.object({ schema }))' },
  { pattern: /\bNoObjectGeneratedError\b/, label: 'NoObjectGeneratedError (deprecated — use NoOutputGeneratedError)' },
]

const aiCheckDirs = ['lib/ai', 'actions'].map(d => join(ROOT, d))
const aiCheckFiles = aiCheckDirs
  .flatMap(walk)
  .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))

for (const file of aiCheckFiles) {
  const src = readFileSync(file, 'utf8')
  const rel = relative(ROOT, file)
  for (const { pattern, label } of DEPRECATED_AI_APIS) {
    if (pattern.test(src)) {
      errors.push(`[ai-sdk] DEPRECATED API: ${rel} — ${label}`)
    }
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

if (errors.length) {
  console.error('\n✗  Type violations (must fix):')
  for (const e of errors) console.error(`   ${e}`)
  process.exit(1)
}

console.log('✓  No inline domain type redefinitions. No deprecated AI SDK APIs.')
