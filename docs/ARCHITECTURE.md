# Patient Coordinator — Architecture

> This document records technical decisions and the reasoning behind them. Every decision has a rationale. If a rationale is missing, the decision should be questioned.

---

## Stack Overview

```
Frontend        Next.js 16 (App Router) + React 19.2 + TypeScript
UI              Shadcn/UI + Tailwind CSS
Database        Supabase (Postgres)
Auth            Supabase Auth
File Storage    Vercel Blob
AI              Claude API via Vercel AI SDK
Deployment      Vercel
```

---

## Key Architectural Decisions

### ADR-001 — App Router over Pages Router

**Decision:** Use Next.js App Router exclusively.

**Rationale:**
- Server Components reduce client bundle for data-heavy views (episode timeline, document list)
- Server Actions simplify form handling without API route boilerplate
- Route-based code splitting is automatic
- Aligns with Vercel Academy Next.js Foundations course completed

**Trade-off:**
Server Actions are new to this codebase. First-time use adds learning overhead on Day 1. Acceptable — this is a deliberate skill investment.

---

### ADR-002 — Supabase over Prisma + separate Postgres

**Decision:** Use Supabase for database, auth, and RLS.

**Rationale:**
- Row Level Security enforced at database level — not application level
- Auth built-in, integrates directly with RLS policies
- Existing comfort level — used multiple times before
- Real-time subscriptions available for V2 live updates

**Trade-off:**
Supabase vendor lock-in for auth and RLS. Acceptable for V1 — migration path exists if needed.

---

### ADR-003 — Vercel Blob for file storage

**Decision:** Use Vercel Blob for medical document storage.

**Rationale:**
- Vercel-native — zero additional configuration
- Simple API — `put()`, `get()`, `del()`
- Returns blob URL but we store only the `pathname` (file_key)

**Critical implementation note:**
Store `blob.pathname` not `blob.url`. The URL is constructed at query time:
```typescript
import { head } from '@vercel/blob';
const { url } = await head(document.file_key);
```
This keeps the database storage-provider-independent.

**Trade-off:**
First-time use. Learn the API on Day 1. Documentation is clear and simple.

---

### ADR-004 — Claude API for AI pipeline

**Decision:** Use Claude via Vercel AI SDK with structured output + Zod schema.

**Rationale:**
- Claude handles multi-page medical documents reliably
- Structured output mode (not freeform) enforces output shape at the model level
- Zod schema provides TypeScript type safety end-to-end
- Vercel AI SDK streaming support available for V2 real-time feedback

**Why not GPT-4 or Gemini:**
Claude is specifically stronger on long-document comprehension and instruction following for constrained output tasks. Medical document translation is a constrained reasoning task, not creative generation.

---

### ADR-005 — Two views, one data model

> **Superseded by ADR-013.** The "different presentation" premise still holds, but the two-route-tree implementation described below was replaced by a single, permission-aware route tree. Kept for history.

**Decision:** Coordinator and patient see different views of the same underlying data. No separate data stores.

**Rationale:**
- Same Episode, same Documents, same Translations — different presentation
- Coordinator view: full detail, all documents, all tasks, all actions
- Patient view: simplified status, plain language only, no raw medical data
- RLS handles access control at database level

**Implementation (superseded — see ADR-013):**
- ~~Coordinator route: `/dashboard/[patientId]`~~
- ~~Patient route: `/patient/[patientId]`~~
- ~~Shared data fetching functions, different UI components~~

---

### ADR-006 — AI pipeline is server-side only

**Decision:** All Claude API calls happen in Server Actions or API Routes. Never client-side.

**Rationale:**
- API key never exposed to client
- Medical document content never sent directly from browser to Claude
- File upload goes: browser → Vercel Blob (via server action) → Claude reads from Blob URL
- Single point of control for prompt versioning and error handling

---

### ADR-007 — Episode Summary regeneration strategy

**Decision:** Regenerate EpisodeSummary synchronously on document upload. Not queued, not async.

**Rationale for V1:**
- Simpler implementation — no queue infrastructure needed
- V1 document volume is low (one family, one episode)
- User expects immediate feedback after upload

**Trade-off:**
Upload flow blocks until summary regeneration completes. Acceptable for V1. If latency becomes a problem, move to background job in V2.

**V2 path:**
Vercel Background Functions or a simple queue. EpisodeSummary shows "Updating..." state while regenerating.

---

## Project Structure

```
patient-coordinator/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (coordinator)/
│   │   ├── layout.tsx
│   │   └── dashboard/
│   │       └── [patientId]/
│   │           ├── page.tsx          ← Episode overview
│   │           ├── documents/
│   │           │   └── page.tsx      ← Document list + upload
│   │           └── tasks/
│   │               └── page.tsx      ← Pending tasks
│   ├── (patient)/
│   │   ├── layout.tsx
│   │   └── patient/
│   │       └── [patientId]/
│   │           └── page.tsx          ← Patient simplified view
│   └── api/
│       └── documents/
│           └── [documentId]/
│               └── file/
│                   └── route.ts      ← Authenticated Blob file-serving route (ADR-008)
├── components/
│   ├── primitives/                   ← Atomic — never AI-generated from scratch
│   │   ├── DocumentTypeTag.tsx
│   │   ├── EpisodeStatusBadge.tsx
│   │   ├── TaskCategoryIcon.tsx
│   │   └── TranslationStatusIndicator.tsx
│   ├── composites/                   ← Assembled from primitives
│   │   ├── DocumentCard.tsx
│   │   ├── EpisodeStatusCard.tsx
│   │   └── PendingTaskRow.tsx
│   └── features/                    ← Full feature sections
│       ├── DocumentUploadZone.tsx
│       ├── EpisodeTimeline.tsx
│       ├── EpisodeSummaryPanel.tsx
│       └── TranslationOutputPanel.tsx
├── lib/
│   ├── ai/
│   │   ├── classify.ts               ← Document classification prompt
│   │   ├── translate.ts              ← Translation prompt + Zod schema
│   │   ├── summarise.ts              ← Episode summary prompt + Zod schema
│   │   ├── schemas.ts                ← All Zod schemas (Classification, Translation, EpisodeSummary)
│   │   ├── models.ts                 ← Model map — Haiku (dev) vs Sonnet (prod) per AI_MODEL_TIER
│   │   └── limits.ts                 ← Page/token limits enforced before Claude calls
│   ├── db/
│   │   ├── episodes.ts               ← Episode queries
│   │   ├── documents.ts              ← Document queries
│   │   ├── translations.ts           ← Translation queries
│   │   ├── episode-summaries.ts      ← upsertEpisodeSummary (version-safe RPC wrapper)
│   │   └── tasks.ts                  ← PendingTask queries
│   ├── storage/
│   │   ├── blob.ts                   ← Vercel Blob wrapper (file_key pattern)
│   │   └── validate.ts               ← Server-side file type + size validation (ADR-010)
│   ├── supabase/
│   │   ├── server.ts                 ← createClient for Server Components + Server Actions
│   │   └── client.ts                 ← createClient for Client Components only
│   └── ratelimit.ts                  ← Upstash rate limiter for upload endpoint (ADR-010)
├── actions/
│   ├── auth.ts                       ← login, register, logout — passes name+role metadata to trigger
│   ├── upload-document.ts            ← validate → rate-limit → upload → classify → translate → summarise
│   ├── create-episode.ts
│   └── resolve-task.ts
├── proxy.ts                          ← Auth guard + role-based routing (Next 16: was middleware.ts)
├── supabase/
│   └── migrations/
│       └── 20240101000000_initial_schema.sql  ← Full schema from DATA_MODEL.md
├── scripts/
│   └── seed-test-db.ts               ← Deterministic test data for integration + E2E tests
└── docs/                             ← This folder
```

---

## AI Pipeline Flow

```
User uploads document
        │
        ▼
[Server Action: upload-document]
        │
        ├─► 1. Store file in Vercel Blob
        │         → returns file_key (pathname only)
        │
        ├─► 2. Create Document record in Supabase
        │         → status: pending_classification
        │
        ├─► 3. Claude: classify document
        │         → input: file from Blob URL
        │         → output: { type, suggested_name, suggested_purpose }
        │         → Zod schema enforced
        │         → User confirms or edits (optimistic UI)
        │
        ├─► 4. Claude: translate document
        │         → input: file + document type context
        │         → output: { plain_language, what_it_means, actions[] }
        │         → Zod schema enforced
        │         → Creates DocumentTranslation + DocumentAction records
        │
        └─► 5. Claude: regenerate episode summary
                  → input: all DocumentTranslations for this episode
                  → output: { visit_purpose, timeline_summary,
                              status_label, status_description }
                  → Zod schema enforced
                  → Updates EpisodeSummary (version + 1, updated_at = now)
```

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # Server-side only

# Vercel Blob
BLOB_READ_WRITE_TOKEN=          # Server-side only

# Anthropic
ANTHROPIC_API_KEY=              # Server-side only

# AI model tier — 'development' uses Haiku, 'production' uses Sonnet
AI_MODEL_TIER=development

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=         # Server-side only
UPSTASH_REDIS_REST_TOKEN=       # Server-side only

# App
NEXT_PUBLIC_APP_URL=
```

---

### ADR-008 — Blob file-serving via authenticated API route

**Decision:** All document file URLs are served through an internal API route, never returned directly to the client.

**Rationale:**
- Vercel Blob `access: 'private'` files cannot be opened directly with a public URL — they require a signed URL
- Signed URL generation must happen server-side after verifying the requesting user has `PatientAccess` for the document's episode
- This prevents URL-guessing attacks: even knowing a `file_key`, a user without PatientAccess cannot retrieve the file

**Implementation contract** (source of truth: `app/api/documents/[documentId]/file/route.ts`):

The `GET` handler must, in this order:
1. Authenticate the caller with `supabase.auth.getUser()` → `401` if no user.
2. Select the document by id through the **RLS-scoped** server client. RLS does the
   authorization: a caller without `PatientAccess` gets zero rows → return `404`
   (not `403` — do not leak that the document exists).
3. Generate the signed Blob URL server-side from `file_key` and `redirect` to it.

**The load-bearing decisions — keep these even if the code changes:**
- Authorization is delegated to RLS, not re-implemented in the route. The query must
  use the request-scoped client (the user's cookies), never the service-role key —
  service role bypasses RLS and would defeat the whole control.
- `file_key` (pathname) is never returned to the client. Only the short-lived signed
  URL is, via redirect.
- A missing-or-unauthorized document returns the same `404` — no existence oracle.

**Trade-off:**
Every document view incurs a Supabase query + Blob signed URL generation. Acceptable for V1 — document views are low frequency. If performance becomes an issue, cache the signed URL with a short TTL (5 min) server-side.

---

### ADR-009 — AI pipeline error handling and document status transitions

**Decision:** The upload Server Action manages `document.status` explicitly at every step. Any failure sets `status = 'failed'` and returns a typed error. No orphaned records.

**Rationale:**
The upload pipeline chains 5 operations (Blob upload → DB insert → classify → translate → summarise). If any step fails without status tracking, the document record exists but is permanently stuck — no way to retry or surface the failure to the user.

**Status transition map:**

```
Upload starts
  → status: pending_classification   (DB record created, blob uploaded)

Step 3 (classify) succeeds
  → status: classified               (type, name, purpose confirmed)

Step 4 (translate) succeeds
  → status: translated               (DocumentTranslation + DocumentActions created)

Any step fails
  → status: failed                   (error stored, user sees retry button)
```

**Error handling pattern in the Server Action:**

```typescript
// actions/upload-document.ts
export async function uploadDocument(formData: FormData) {
  let documentId: string | null = null

  try {
    // Step 1+2: Blob + DB insert
    const { id, fileKey } = await createDocumentRecord(...)
    documentId = id

    // Step 3: Classify
    const classification = await classifyDocument(fileUrl)
    await supabase.from('documents')
      .update({ ...classification, status: 'classified' })
      .eq('id', documentId)

    // Step 4: Translate
    const translation = await translateDocument(...)
    await createTranslationRecords(documentId, translation)
    await supabase.from('documents')
      .update({ status: 'translated' })
      .eq('id', documentId)

    // Step 5: Regenerate episode summary (non-fatal — failure here does not block)
    try {
      await regenerateEpisodeSummary(episodeId)
    } catch (summaryError) {
      console.error('Summary regeneration failed — kept previous version', summaryError)
    }

    return { success: true, documentId }

  } catch (error) {
    // Mark document as failed so user can retry — do not delete
    if (documentId) {
      await supabase.from('documents')
        .update({ status: 'failed' })
        .eq('id', documentId)
    }
    return { success: false, error: 'Translation failed — tap to retry' }
  }
}
```

**Key decisions:**
- Episode summary regeneration failure is non-fatal — the previous summary is kept, the document is still marked `translated`
- Document records are never deleted on failure — `status: failed` surfaces retry UI
- Retry re-runs Steps 3–5 only (file already in Blob, DB record already exists)

---

### ADR-010 — Server-side file validation, rate limiting, and upload idempotency

**Decision:** Three upload safety mechanisms enforced in the Server Action before any Blob or Claude call.

#### File validation (server-side)

Client-side validation is advisory only — it can be bypassed. Server-side validation is the enforcement boundary.

```typescript
// lib/storage/validate.ts
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
])
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  // 10 MB

export function validateUploadedFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { valid: false, error: 'Only PDF, JPG, PNG, and HEIC files are accepted.' }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File must be under 10 MB.' }
  }
  return { valid: true }
}
```

#### Rate limiting

A coordinator uploading 100 documents in rapid succession would trigger 300+ Claude API calls. Rate limiting is enforced per-user in the Server Action.

**V1 approach — simple in-memory rate limit using Vercel Edge config or Upstash Redis:**
- Max 10 uploads per user per hour
- Response: HTTP 429 with "You've uploaded several documents quickly. Please wait a few minutes."

```typescript
// lib/ratelimit.ts
// Use Upstash Redis @upstash/ratelimit for production-safe rate limiting
// npm add @upstash/ratelimit @upstash/redis
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const uploadRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'carealign:upload',
})
```

In the Server Action:
```typescript
const { success } = await uploadRateLimit.limit(userId)
if (!success) {
  return { success: false, error: 'Upload limit reached. Please wait before uploading more documents.' }
}
```

**Trade-off:**
Upstash Redis adds one external dependency. Acceptable — it's Vercel-native and has a generous free tier. Alternative for V1: simple Supabase-backed count query (less accurate but zero new dependencies).

#### Upload idempotency

If the user re-uploads the same file (network timeout, double-submit), the current design creates a duplicate Document record. Prevention:

```typescript
// Before creating the Document record, check for an existing document
// with the same file name, episode, and document_date
const { data: existing } = await supabase
  .from('documents')
  .select('id, status')
  .eq('episode_id', episodeId)
  .eq('name', file.name)
  .is('deleted_at', null)
  .single()

if (existing) {
  if (existing.status === 'translated') {
    return { success: true, documentId: existing.id, duplicate: true }
  }
  if (existing.status === 'failed') {
    // Re-run pipeline on existing record
    documentId = existing.id
    // ... continue to classify/translate
  }
}
```

**Note:** Name-based deduplication is a heuristic — two different prescriptions could share the same filename. In V2, use file content hash (SHA-256) for reliable deduplication.

---

### ADR-011 — proxy.ts as the single auth and routing boundary

> **Partially superseded by ADR-013.** Session validation and the request-lifecycle mechanics below are unchanged. The role-based routing table (patient→`/patient/[id]`, coordinator→`/dashboard/[id]`) is not — there is one route tree now, and `proxy.ts` no longer branches on `profiles.role` at all. Kept for the parts that still apply.

**Decision:** All session validation and role-based routing lives in `proxy.ts`. No page or layout performs its own auth redirect.

**Rationale:**
- `proxy.ts` runs before every request — it is the only guaranteed interception point that covers pages, layouts, and API routes uniformly
- Session token refresh must happen on every navigation, not just on specific layouts
- `getUser()` validates the JWT with Supabase Auth servers — `getSession()` only reads the cookie without verification and is unsafe for routing decisions

**The two Supabase clients — why both exist:**

| Client | File | Used in | Why |
|--------|------|---------|-----|
| Server client | `lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers | Reads/writes cookies via `next/headers`. Async (`await createClient()`). Queries run as the authenticated user — RLS applies automatically. |
| Browser client | `lib/supabase/client.ts` | Client Components (`'use client'`) | Reads cookies from the browser. Same RLS applies. The publishable key is safe to expose — it grants nothing without a valid session. |

**Request lifecycle — what happens on every navigation:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│    │                                                                │
│    │  GET /dashboard  (with session cookie)                         │
│    ▼                                                                │
├─────────────────────────────────────────────────────────────────────┤
│  proxy.ts  (runs before the page, on every matched request)         │
│    │                                                                │
│    ├─ 1. createServerClient()  ← reads cookies from request         │
│    │                                                                │
│    ├─ 2. supabase.auth.getUser()                                    │
│    │         └─► validates JWT with Supabase Auth servers           │
│    │             (not getSession — that trusts the cookie blindly)  │
│    │                                                                │
│    ├─ [no user]  ──────────────────────► redirect → /login         │
│    │                                                                │
│    ├─ [user exists] at /, /login, or /register                      │
│    │      └─ fetch all patient_access rows for this user            │
│    │            └─ resolveHomePath(rows) — see ADR-013:              │
│    │               exactly one row  ──► /dashboard/[id]/summary     │
│    │               zero or many     ──► /dashboard                  │
│    │                                                                │
│    │      (per-record correctness for /dashboard/[id]/* is NOT      │
│    │       proxy.ts's job — the layout's own getPatientAccess(id)   │
│    │       check handles it; see ADR-013)                            │
│    │                                                                │
│    └─ 3. setAll() writes refreshed token into response cookies      │
│              └─► browser gets updated token transparently           │
│                  (prevents session expiry mid-session)              │
│    │                                                                │
│    └─ pass request through → page renders                           │
├─────────────────────────────────────────────────────────────────────┤
│  Page / Layout / Server Action                                      │
│    └─ await createClient()  ← same refreshed session               │
│         └─► all DB queries automatically scoped by RLS             │
└─────────────────────────────────────────────────────────────────────┘
```

**Auth actions lifecycle (`actions/auth.ts`):**

```
register(formData)
  │
  ├─ supabase.auth.signUp({ email, password, data: { name, role } })
  │         │
  │         └─► Supabase inserts row into auth.users
  │                   │
  │                   └─► handle_new_user trigger fires  (migration Phase 2)
  │                             └─► profiles row auto-created
  │                                 (name + role from metadata)
  └─ redirect('/dashboard')

login(formData)
  ├─ supabase.auth.signInWithPassword()
  ├─ fetch all patient_access rows for this user
  └─ redirect(resolveHomePath(rows))   ← same helper proxy.ts uses (ADR-013)

logout()
  ├─ supabase.auth.signOut()  ← clears session cookie
  └─ redirect('/login')
```

**Why session refresh belongs in proxy.ts and not a layout:**
A layout only runs when that specific route renders. `proxy.ts` runs on every navigation including API routes and redirects. Moving refresh to a layout would silently drop token refresh for any path that layout doesn't cover.

---

## Security Considerations

1. **API keys server-side only** — ANTHROPIC_API_KEY, BLOB_READ_WRITE_TOKEN, SUPABASE_SERVICE_ROLE_KEY never exposed to client
2. **RLS on all tables** — enforced at database level with explicit per-table policies (see DATA_MODEL.md)
3. **File access** — document files served only via `/api/documents/[documentId]/file` route (ADR-008). RLS enforces PatientAccess on every request.
4. **Server-side file validation** — MIME type and size enforced in the Server Action before any Blob or Claude call (ADR-010)
5. **Rate limiting** — 10 uploads per user per hour via Upstash Redis (ADR-010)
6. **No sensitive IDs stored** — Aadhaar and PAN explicitly excluded from schema
7. **Soft deletes** — no health data is permanently deleted
8. **No audit log in V1** — who accessed which document is not logged. If compliance becomes a requirement before V2, add a `document_access_log` table.

---

## ADR-012 — Phase 5 File Upload Flow

### Flow diagram

```
Coordinator optionally fills hint fields (document type, hospital)
         │  both optional — Claude is the source of truth, hints are advisory
         ▼
Coordinator clicks/drops a file
         │
         ▼
DocumentUploadZone (Client Component)
  ├─ validateDocumentFile()        ← MIME type + size check (client-side, instant feedback)
  │   fail → show error state, "Try again"
  │   pass ↓
  ├─ setState({ status: 'uploading' })
  └─ uploadDocument(episodeId, formData)   ← Server Action
             │  formData includes: file, hint_type?, hint_custom_type?, hint_source_hospital?
             ▼
      actions/upload-document.ts
       1. getUser()                ← auth check
       2. uploadRatelimit.limit()  ← 10/hr per user (Upstash Redis)
       3. UploadHintsSchema.parse() ← validate optional hint fields
       4. validateDocumentFile()   ← server-side re-validation (never trust client)
       5. INSERT documents row     ← status: pending_classification, file_key: 'pending'
                                      seeds hint fields immediately (type, source_hospital,
                                      purpose if custom_type provided)
       6. uploadToBlob()           ← Vercel Blob, private
                                      path: documents/{episodeId}/{docId}/{filename}
           fail → UPDATE status: failed, return error (record kept, never deleted)
           pass ↓
       7. UPDATE documents.file_key ← stores pathname only, never the full URL
       8. return { ok: true, documentId }
             │
             ▼
DocumentUploadZone
  ├─ ok: true  → resets hints + state, fires onUploadComplete(documentId)
  └─ ok: false → error state with message + "Try again"

Post-classification — coordinator reviews AI output on DocumentCard:
  ├─ AI output matches hint → no action needed
  └─ Discrepancy noticed → click pencil → DocumentClassificationEditor opens
       ├─ Edit: type, purpose, source_hospital, source_department, document_date
       └─ Save → actions/update-document-classification.ts
                  └─ RLS enforces coordinator-only UPDATE
                     revalidates /dashboard/[patientId]

File access — coordinator views a document:
GET /api/documents/[documentId]/file
  1. getUser()       ← auth check
  2. SELECT file_key FROM documents WHERE id = documentId
                     ← RLS enforces coordinator-only access
  3. getSignedBlobUrl(file_key)   ← Vercel Blob short-lived signed URL
  4. 302 redirect → signed URL   ← raw Blob URL never returned to client
```

### Key decisions

- **Client-side validation runs first** — instant feedback without a network round-trip.
  Server Action re-validates independently — client input is never trusted.
- **Hints are advisory, not overrides** — coordinator type/hospital are seeded into the
  document record immediately so the UI is not blank while AI runs. Claude's classification
  output then confirms or replaces these. No special merge logic — Claude always wins.
- **Custom document type stored in `purpose`** — type='other' + custom label in purpose.
  No `custom_type` column added to documents. Keeps the enum clean.
- **Post-classification edit via `DocumentClassificationEditor`** — coordinator can correct
  any field after AI runs. Uses `updateDocumentClassification` server action; RLS enforces
  coordinator-only access.
- **Document record is created before Blob upload** — gives us an ID for the Blob path.
  If upload fails, the record stays with `status: failed`. Never deleted.
- **`file_key` stores Blob pathname only** — full URL changes when Blob store migrates.
  Signed URLs are generated fresh on every file access request.
- **Rate limit is per user ID** — prevents a single coordinator from triggering
  runaway Claude API costs if they accidentally loop an upload.

---

## ADR-013 — Unified access model: one route tree, per-record permissions

**Decision:** Collapse the two separate route trees (`app/(coordinator)/dashboard/[patientId]`, `app/(patient)/patient/[patientId]`) into one (`app/(app)/dashboard/[patientId]`). "Coordinator" is no longer an account-wide type read from `profiles.role` — it's a permission held per `(user_id, patient_id)` pair in `patient_access.role`, checked fresh on every record. Supersedes the routing portions of ADR-005 and ADR-011.

**Why now:**
Competitor research (`docs/ONBOARDING_RESEARCH.md`) found that products which actually solve "one person manages several people's health records" (MyChart, EkaCare) use one shell with per-record permissions — none run separate apps for "the person managing" vs. "the person being managed." CareAlign's original two-tree split wasn't validated by any product researched; the market gap CareAlign is aiming at (a one-stop family health record vault, per `docs/PRIVACY_TRUST_RESEARCH.md`) requires one person to simultaneously hold coordinator access to one relative's record and patient-role access to their own — the old model made that structurally impossible, since every gate checked one account-wide `profiles.role`.

**What changed:**
- `proxy.ts` and `actions/auth.ts` no longer branch on `profiles.role`. Both use `resolveHomePath()` (`lib/auth/resolve-home-path.ts`) fed by the user's full `patient_access` row list: exactly one row → straight to that record; zero or many → the `/dashboard` shell (which already renders the right thing — empty state, single list, or search — regardless of role mix).
- `app/(app)/layout.tsx` (renamed from `app/(coordinator)/layout.tsx`) admits any authenticated user — no role check. Its sidebar (`CoordinatorSidebarNav`) is fed `getMyAccessList()` (all roles), not the old coordinator-only `getCoordinatorPatients()`.
- `app/(app)/dashboard/[patientId]/layout.tsx` calls `getPatientAccess(patientId)` — the same per-record primitive that already existed — and branches its header, tab nav (`PatientTabNav`, now taking a `role` prop instead of two separate components), and action buttons on the result. This is the one and only per-record gate; `proxy.ts` does not duplicate it.
- `actions/create-patient.ts` no longer checks `profile.role === 'coordinator'` before allowing patient creation — any authenticated user can create a record and becomes its coordinator for that record only.
- `profiles.role` still exists and is still set at signup, but is now purely a display/history field (which page a user's very first session looked like) — it is not read by any auth gate.

**What this enabled (see also ADR "Bilateral revocation" content in DATA_MODEL.md's `patient_access` RLS section):** `patient_access` gained `provenance` (`self_consented` | `coordinator_attested`) and real DELETE policies, so a patient can revoke a coordinator's access to their own record independent of who granted it, and a coordinator can self-revoke (guarded against orphaning a record with no other coordinator). These didn't strictly require the route unification, but were designed and shipped together because both come from the same underlying shift: access is a record-level fact you can inspect and act on, not a role baked into an account.

**Explicitly not done in this pass:** an "invite a second coordinator" flow (so self-revoke is currently a near-universal no-op — every existing patient has exactly one coordinator), and the onboarding-checklist UI. Both are deliberate follow-ups, not oversights.
