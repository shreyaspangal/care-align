/**
 * Checks that every component file in components/ has a colocated .stories.tsx,
 * AND that the story file exports at least one story that references the component.
 *
 * Staleness check: if a component exports a named function/const that isn't
 * referenced anywhere in its story file, it flags it for review.
 *
 * Run: node scripts/check-stories.mjs
 * Exit 1 on any violation.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = process.cwd()

// Folders that require colocated stories
const SCOPED_DIRS = ['components/primitives', 'components/composites', 'components/features']

function walk(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) results.push(...walk(full))
    else results.push(full)
  }
  return results
}

function extractExports(src) {
  // Match: export function Foo / export const Foo / export default function Foo
  const matches = [...src.matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g)]
  return matches.map(m => m[1])
}

function extractStoryExports(src) {
  const matches = [...src.matchAll(/export\s+(?:const|function)\s+([A-Z][A-Za-z0-9_]*)/g)]
  return matches.map(m => m[1])
}

let errors = []
let warnings = []

for (const scopeDir of SCOPED_DIRS) {
  const absDir = join(ROOT, scopeDir)
  if (!existsSync(absDir)) continue

  const allFiles = walk(absDir)
  const componentFiles = allFiles.filter(
    f => f.endsWith('.tsx') && !f.endsWith('.stories.tsx')
  )

  for (const compFile of componentFiles) {
    const storyFile = compFile.replace('.tsx', '.stories.tsx')
    const rel = relative(ROOT, compFile)

    // ── 1. Missing story ─────────────────────────────────────────────────────
    if (!existsSync(storyFile)) {
      errors.push(`MISSING STORY: ${rel}`)
      continue
    }

    const storySrc = readFileSync(storyFile, 'utf8')
    const storyExports = extractStoryExports(storySrc)

    // ── 2. Empty story file (no exported stories) ────────────────────────────
    // Filter out the default export (meta) — we want actual story exports
    const storyNames = storyExports.filter(n => n !== 'default' && n !== 'meta')
    if (storyNames.length === 0) {
      errors.push(`EMPTY STORIES: ${relative(ROOT, storyFile)} — no stories exported`)
      continue
    }

    // ── 3. Staleness: component exports a public symbol not referenced in story
    const compSrc = readFileSync(compFile, 'utf8')
    const compExports = extractExports(compSrc).filter(n => n !== 'default')

    for (const sym of compExports) {
      // Check if the story file imports or references the symbol at all
      if (!storySrc.includes(sym)) {
        warnings.push(
          `STALE STORY: ${relative(ROOT, storyFile)} — component exports '${sym}' but story doesn't reference it`
        )
      }
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

if (warnings.length) {
  console.warn('\n⚠  Story staleness warnings:')
  for (const w of warnings) console.warn(`   ${w}`)
}

if (errors.length) {
  console.error('\n✗  Story violations (must fix):')
  for (const e of errors) console.error(`   ${e}`)
  process.exit(1)
}

if (!warnings.length && !errors.length) {
  console.log('✓  All components have up-to-date colocated stories.')
}
