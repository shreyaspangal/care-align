// Module-resolution shim so the eval harness can run the REAL pipeline modules
// under plain Node — no bundler, no ts-node/tsx dependency (nothing new in
// package.json, so no DECISIONS.md entry is owed; see eval/README.md).
//
// Node 22.18+/24 strip TypeScript types natively, so `.ts` files execute as-is.
// Two things Node still can't do on its own for this repo:
//   1. `@/*` — a tsconfig path alias. Node has no idea what it means.
//   2. `server-only` — its default export throws on import (it's a marker
//      package for the Next.js bundler). The eval harness IS a server process,
//      so we resolve it to the package's own no-op `empty.js`, exactly the way
//      the `react-server` export condition does inside Next.
//
// Deliberately narrow: only bare `@/…` specifiers and the literal string
// `server-only` are intercepted. Everything else falls through to Node's own
// resolver untouched, so nothing inside node_modules changes behaviour.
//
// Registered via `node --import ./eval/loader.mjs …` (see package.json scripts).

import { registerHooks } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

// Both native type stripping and `registerHooks` landed in 22.18/22.15. CI
// pins Node 22 (`.github/workflows/ci.yml`), which resolves to a newer patch
// than either — but fail with a sentence instead of "Unknown file extension
// .ts" if someone runs this on an older local Node.
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(
    `The eval harness needs Node >= 22.18 for native TypeScript type stripping (found ${process.versions.node}).`
  )
  process.exit(1)
}

const repoRoot = path.resolve(import.meta.dirname, '..')
const serverOnlyStub = path.join(repoRoot, 'node_modules', 'server-only', 'empty.js')

function firstExistingFile(candidates) {
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only' && existsSync(serverOnlyStub)) {
      return { url: pathToFileURL(serverOnlyStub).href, shortCircuit: true }
    }

    if (specifier.startsWith('@/')) {
      const base = path.join(repoRoot, specifier.slice(2))
      // `@/*` is only ever written by this repo's own `import` statements, so
      // there's no untrusted input reaching this resolver in practice — but a
      // `../` segment in a specifier (e.g. `@/../../../etc/hosts`) would
      // otherwise resolve outside repoRoot for free. One check closes it.
      if (!base.startsWith(repoRoot + path.sep) && base !== repoRoot) {
        throw new Error(`[eval/loader] "${specifier}" resolves outside the repo root`)
      }
      const resolved = firstExistingFile([
        base,
        `${base}.ts`,
        `${base}.tsx`,
        path.join(base, 'index.ts'),
        path.join(base, 'index.tsx'),
      ])
      if (!resolved) {
        throw new Error(`[eval/loader] cannot resolve "${specifier}" from ${context.parentURL}`)
      }
      return { url: pathToFileURL(resolved).href, shortCircuit: true }
    }

    return nextResolve(specifier, context)
  },
})
