# CareAlign — Anti-Patterns

> The "known mistakes" list. Patterns that AI instinctively reaches for that are wrong in this specific stack.
> Each entry has: what AI does, what to do instead, why, and a code example.
>
> Quick-reference table → `AGENTS.md`. Deep rules → `CLAUDE.md`.

---

## 1. `middleware.ts` → use `proxy.ts`

**What AI does:** Creates `middleware.ts` with `export function middleware(request)`.

**Why it's wrong:** Next 16 renamed the file and the export. `middleware.ts` is silently ignored.

**What to do:**
```typescript
// proxy.ts — not middleware.ts
export function proxy(request: NextRequest) { ... }
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'] }
```

Config flags also renamed: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`.

---

## 2. `generateObject()` / `streamObject()` → use `generateText + Output.object`

**What AI does:** Imports `generateObject` or `streamObject` from the `ai` package.

**Why it's wrong:** Both are `@deprecated` in AI SDK v6. The ESLint rule `carealig/no-deprecated-ai-sdk` will fail CI.

**What to do:**
```typescript
import { generateText, Output } from 'ai'
import { NoOutputGeneratedError } from 'ai'

const result = await generateText({
  model: anthropic(AI_MODELS.classify),
  experimental_output: Output.object({ schema: ClassificationSchema }),
  temperature: 0.0,
  messages: [{ role: 'user', content: [...] }],
})
// result.experimental_output is typed as ClassificationSchema
```

Catch `NoOutputGeneratedError`, not `NoObjectGeneratedError` (the old name).

Canonical pattern: `lib/ai/classify.ts`.

---

## 3. `getSession()` → use `getUser()`

**What AI does:** Calls `supabase.auth.getSession()` to check if the user is logged in.

**Why it's wrong:** `getSession()` reads the session cookie and trusts it without validating the JWT with Supabase Auth servers. It can return a stale or forged session. This is a security hole in auth guards.

**What to do:**
```typescript
const { data: { user }, error } = await supabase.auth.getUser()
if (!user) redirect('/login')
```

`getUser()` validates the JWT on every call. Use it in `proxy.ts`, server actions, and route handlers.

---

## 4. `mimeType` on `FilePart` → use `mediaType`

**What AI does:** Passes `mimeType: 'application/pdf'` on a `FilePart` object.

**Why it's wrong:** AI SDK v6 renamed the field to `mediaType`. `mimeType` is silently ignored, causing Claude to receive the file without type context.

**What to do:**
```typescript
{
  type: 'file',
  data: fileBuffer,
  mediaType: 'application/pdf',   // not mimeType
}
```

---

## 5. `NoObjectGeneratedError` → use `NoOutputGeneratedError`

**What AI does:** Catches `NoObjectGeneratedError` from the `ai` package.

**Why it's wrong:** This error class was renamed when `generateObject` was deprecated. Importing it will throw at module load time in AI SDK v6.

**What to do:**
```typescript
import { NoOutputGeneratedError } from 'ai'

try {
  const result = await generateText({ ... })
} catch (error) {
  if (error instanceof NoOutputGeneratedError) { ... }
}
```

---

## 6. Store `blob.url` → store `blob.pathname`

**What AI does:** Saves the full Blob URL (`https://...vercel-storage.com/...`) to the database.

**Why it's wrong:** The URL is not stable — it changes if the Blob store is migrated or the account changes. Stored URLs become broken links.

**What to do:**
```typescript
const blob = await put(path, file, { access: 'private' })
// Store blob.pathname — NOT blob.url
await supabase.from('documents').update({ file_key: blob.pathname })

// At read time, reconstruct the signed URL:
const { url } = await head(document.file_key)
```

ADR-003 in `docs/ARCHITECTURE.md` documents this decision.

---

## 7. Sync `cookies()` → must `await`

**What AI does:** Calls `cookies()` synchronously based on Next.js 14/15 patterns.

**Why it's wrong:** Next 16 made `cookies()` (and `headers()`) async-only. Sync usage throws at runtime.

**What to do:**
```typescript
// lib/supabase/server.ts
export async function createClient() {
  const cookieStore = await cookies()   // must await
  return createServerClient(...)
}

// every caller
const supabase = await createClient()  // must await
```

---

## 8. `supabase.from()` in `page.tsx` / `layout.tsx` → use DAL

**What AI does:** Queries Supabase directly inside a page or layout component.

**Why it's wrong:** Hard Rule 12. Direct queries in pages/layouts are not `cache()`-wrapped, so the same query fires multiple times per render. The DAL boundary is also an audit boundary — scattered queries are invisible to security review. ESLint rule `carealig/no-supabase-table-query-in-pages` will fail CI.

**What to do:**
```typescript
// lib/dal/patients.ts
export const getPatient = cache(async (patientId: string) => {
  const supabase = await createClient()
  return supabase.from('patients').select('*').eq('id', patientId).single()
})

// app/(app)/dashboard/[patientId]/page.tsx
const { data: patient } = await getPatient(patientId)
```

`supabase.auth.getUser()` is allowed inline — auth, not data.

---

## 9. Import server actions in `'use client'` → inject as prop

**What AI does:** Imports a server action directly at the top of a client component.

```typescript
// WRONG
'use client'
import { uploadDocument } from '@/actions/upload-document'
```

**Why it's wrong:** Hard Rule 11. The import pulls `next/cache`, `next/headers`, and other Node-only modules into the client bundle, crashing Storybook and the test runner. ESLint rule `carealig/no-client-action-import` will fail CI.

**What to do:**
```typescript
// The RSC page receives the action from Next's server context and passes it as a prop
// app/(app)/dashboard/[patientId]/page.tsx (RSC)
import { uploadDocument } from '@/actions/upload-document'
import { DocumentUploadZone } from '@/components/features/DocumentUploadZone'

export default async function Page() {
  return <DocumentUploadZone onUpload={uploadDocument} />
}

// components/features/DocumentUploadZone.tsx ('use client')
type Props = { onUpload: typeof import('@/actions/upload-document').uploadDocument }
```

`import type { ... }` from `@/actions/*` is allowed — type-only imports are erased at compile time.

---

## 10. Inline domain type definitions → import from `lib/types/domain.ts`

**What AI does:** Redefines a DB-aligned type inline.

```typescript
// WRONG — anywhere except lib/types/domain.ts
type DocumentType = 'prescription' | 'lab_report' | 'discharge_summary' | ...
```

**Why it's wrong:** Hard Rule 13. When a DB enum changes, only `lib/types/domain.ts` needs updating. Inline copies drift silently. ESLint rule `carealig/no-inline-domain-types` will fail CI.

**What to do:**
```typescript
import type { DocumentType, EpisodeStatus, TaskCategory } from '@/lib/types/domain'
```

Governed types: `DocumentType`, `EpisodeStatus`, `TaskCategory`, `TranslationStatus`, `DocumentStatus`, `ActionFor`, `TaskPhase`, `TaskStatus`, `UserRole`, `AdmissionStatus`.

---

## 11. `params.id` in route handlers → must `await params`

**What AI does:** Destructures `params` synchronously in a route handler or page.

```typescript
// WRONG
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params
```

**Why it's wrong:** Next 16 made `params` a Promise in dynamic route handlers and pages. Sync access returns `undefined`.

**What to do:**
```typescript
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
```

Same applies to `page.tsx` props: `({ params }: { params: Promise<{ patientId: string }> })`.

---

## 12. Plain `.upsert()` on `episode_summaries` → use the RPC

**What AI does:** Uses `supabase.from('episode_summaries').upsert({ ... })`.

**Why it's wrong:** Plain upsert resets the `version` counter to 1 on every update, destroying the version history that lets the UI show "last updated X".

**What to do:**
```typescript
import { upsertEpisodeSummary } from '@/lib/db/episode-summaries'
await upsertEpisodeSummary(episodeId, summaryOutput)
```

The function calls the `upsert_episode_summary` Postgres RPC which increments `version` atomically. Source: `lib/db/episode-summaries.ts`.

---

## 13. RLS without an UPDATE/DELETE policy → silent write failure

**What AI does:** Adds a column, grants `UPDATE (col) TO authenticated`, writes a server action that calls `.update()`, and it appears to succeed.

**Why it's wrong:** `GRANT` covers the PostgreSQL permission layer. RLS covers the row-visibility layer. Both must pass. A table with RLS enabled but no UPDATE policy defaults to deny all updates — `{ error: null, count: 0 }` is the silent result.

**This has happened 3 times in this codebase:**
- `patient_invites.expires_at` — silently updated 0 rows in production
- `patient_invites.pin_locked_at` — caught before shipping
- `patient_access.pinned_at` — silently updated 0 rows

**How to check:** After writing any `.update()` or `.delete()`, grep migrations:
```bash
grep -n "FOR UPDATE\|FOR DELETE" supabase/migrations/*.sql | grep <table_name>
```

If no policy exists, use `createServiceClient()` (service role bypasses RLS) after manually verifying the caller's permissions in application code. See `actions/pin-patient.ts` for the pattern.
