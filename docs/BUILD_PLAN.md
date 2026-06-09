# Patient Coordinator — 5-Day V1 Build Plan

## Reality Check Before Starting

**What V1 is:**
A working product where a coordinator can upload a medical document, receive a plain-language translation, and see an episode timeline with a living summary. Both coordinator and patient views exist. Real document test passes.

**What V1 is not:**
Pixel-perfect, fully edge-case-handled, or production-scaled. It is real, live, and demonstrable.

**Your exit criteria (from SPEC.md):**
1. Upload prescription, lab report, discharge summary → patient and coordinator can understand current status and what to expect
2. One non-developer hospital coordinator uses it without instructions and finds it useful in 5 minutes
3. Product does not extract medication schedules automatically — can explain why in one sentence

---

## The Verification Loop (read before every task)

An AI agent must not grade its own work. After writing or changing code, the agent
closes the loop by running the **machine-checkable** gate for what it touched — and
only hands back to you when that gate is green. Two distinct kinds of signal exist;
do not confuse them:

| Signal | Who can run it | What it proves |
|--------|---------------|----------------|
| **Machine gate** — `tsc`, unit/integration tests, lint | The agent, every change | The code does what the spec says structurally |
| **Human gate** — the real-document test, the 5-minute test | Only you | The output is *warm and understandable* — un-automatable |

**The rule:** the agent runs the machine gate itself and reports the result before
asking for your judgment. You spend your attention on the human gate, not on catching
type errors the agent could have caught.

**Gate by task type:**

| When the agent builds… | It must run, and report green, before handoff |
|------------------------|-----------------------------------------------|
| Any TypeScript change | `pnpm tsc --noEmit` |
| A primitive/composite component | its render test (`pnpm test <file>`) — all prop values |
| `lib/storage/validate.ts`, `lib/ratelimit.ts`, Zod schemas | the matching unit test |
| A Server Action (`actions/*`) | the integration test with MSW + test DB |
| Any RLS policy or migration | the RLS integration tests (`__tests__/integration/rls/`) |
| A prompt change in `lib/ai/*` | the adversarial **response-handling** test (MSW, fast). The real-Claude **boundary** test is the human-supervised gate — run it deliberately, not in the loop |

**What stays a human gate (never claim these as "passing" from a machine run):**
- The real-document test ([3.8], [5.8] Test 1) — could dad act on the output unaided?
- The 5-minute non-developer test ([5.8] Test 2)
- Prompt *warmth* and tone — Zod proves shape, not humanity

See TESTING.md for every test referenced here. If a gate for a task does not exist
yet, the agent writes the test first, then the code — that is what makes the loop real.

---

## Pre-Day-0 Checklist (before Day 1 starts)

- [ ] Get at least one real medical document from dad (blood test, prescription, or discharge summary)
- [ ] Download "Eka Health AI" app from App Store/Play Store — use it with the document, note where it fails
- [ ] Create Anthropic account if not already done
- [ ] Create Vercel account and new project
- [ ] Create Supabase project
- [ ] Email ekaconnect@eka.care briefly explaining the project and requesting developer access

---

## Day 1 — Foundation (10–12 hours)

**Goal:** Everything is set up. Database schema is live. Auth works. You can log in as both a coordinator and a patient.

### Morning (4 hours)

**[1.1] Project initialisation (45 min)**
```bash
pnpm create next-app@latest patient-coordinator \
  --typescript --tailwind --app --src-dir --import-alias "@/*"
cd patient-coordinator
pnpm dlx shadcn@latest init
```

Install core dependencies:
```bash
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add @vercel/blob
pnpm add ai @ai-sdk/anthropic
pnpm add zod
pnpm add @upstash/ratelimit @upstash/redis
```

Install dev/test dependencies:
```bash
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom
pnpm add -D @playwright/test msw
pnpm add -D supabase
```

**[1.2] Environment setup (15 min)**

First, create `.env.example` and commit it (safe — no real values):
```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BLOB_READ_WRITE_TOKEN=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
AI_MODEL_TIER=development
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Then copy to `.env.local` and fill in values. Add `.env.local` to `.gitignore` immediately.
```bash
cp .env.example .env.local
echo ".env.local" >> .gitignore
```

**[1.3] Supabase database schema + migration workflow (2 hours)**

Set up the Supabase CLI and migration file first — this makes Day 2+ schema changes safe and reproducible:

```bash
pnpm add -D supabase
pnpm supabase init                          # creates supabase/ directory
pnpm supabase login
pnpm supabase link --project-ref <your-project-ref>
```

Create the first migration file:
```bash
pnpm supabase migration new initial_schema
# Creates: supabase/migrations/20240101000000_initial_schema.sql
```

Paste the full schema from DATA_MODEL.md into that file. Order matters:
1. Create all enum types first
2. Create the `user_has_patient_access` helper function
3. Create tables in dependency order: users → patients → patient_access → episodes → documents → document_translations → document_actions → episode_summaries → pending_tasks
4. Add all indexes
5. Enable RLS on all tables
6. Add all RLS policies from DATA_MODEL.md

Apply to your remote Supabase project:
```bash
pnpm supabase db push
```

For all future schema changes: create a new migration file, never edit previous ones. This keeps history intact and makes rollback possible.

Verify: open Supabase table editor, confirm all 9 tables exist with correct columns.

**[1.4] Supabase client setup (30 min) [NEW — server components pattern]**

> **Next.js 16 note:** `cookies()` is async-only (the v15 sync compatibility was removed
> in v16). `createClient()` must therefore be `async` and `await cookies()`. Every caller
> awaits it: `const supabase = await createClient()`.

```typescript
// lib/supabase/server.ts — for Server Components and Server Actions
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()        // Next 16: cookies() is async
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Required so Supabase can refresh the auth token. In a pure Server
          // Component this can throw (read-only cookies) — safe to ignore there;
          // proxy.ts handles refresh on navigation.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            /* called from a Server Component — ignore */
          }
        },
      },
    }
  )
}

// lib/supabase/client.ts — for Client Components only
import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Afternoon (4 hours)

**[1.5] Auth routes (2 hours) [NEW — Server Actions for auth]**

Create:
- `app/(auth)/login/page.tsx` — email + password form
- `app/(auth)/register/page.tsx` — name + email + password + role selection
- `actions/auth.ts` — login, register, logout Server Actions

```typescript
// actions/auth.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message }
  redirect('/dashboard')
}

export async function register(formData: FormData) {
  const supabase = createClient()
  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        name: formData.get('name') as string,
        role: formData.get('role') as string,
        // Picked up by the handle_new_user trigger to create the profiles row
      },
    },
  })
  if (error) return { error: error.message }
  redirect('/dashboard')
}

export async function logout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

**[1.6] Route protection via `proxy.ts` (45 min)**

> **Next.js 16 note:** the `middleware.ts` filename and the `middleware` named export
> are deprecated in v16 — renamed to **`proxy.ts`** with `export function proxy(...)`.
> `proxy` runs the `nodejs` runtime (not edge). Use `proxy.ts`; do not create
> `middleware.ts`. Config flags renamed too (e.g. `skipMiddlewareUrlNormalize` →
> `skipProxyUrlNormalize`).

Build `proxy.ts`. The file is the source of truth; this section is the spec it
must satisfy. Implement these rules in order — the first match wins:

1. **No session** + not on `/login` or `/register` → redirect to `/login`.
2. **Session exists** → fetch `role` from `profiles` (not `users` — see CLAUDE.md rule 5).
3. **Patient on `/dashboard/...`** → redirect to `/patient/[patientId]` (parse `patientId`
   from the path; if absent, send to `/login`).
4. **Coordinator on `/patient/...`** → redirect to `/dashboard/[patientId]`.
5. **Logged-in user on `/login` or `/register`** → redirect to their role home.

Matcher must exclude static assets and API routes:
```typescript
// proxy.ts
export function proxy(request: NextRequest) { /* rules above */ }
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'] }
```

**The one non-obvious part — get this right or sessions silently break:** with
`@supabase/ssr` you must construct the client with `cookies.getAll()` reading from
`request.cookies` **and** `cookies.setAll()` writing to the *response* you return.
Read the user with `supabase.auth.getUser()` (validates the token), never
`getSession()` (trusts the cookie blindly). Refer to the current Supabase Next.js
middleware/proxy guide for the exact cookie wiring — it changes between `@supabase/ssr`
versions, which is why the boilerplate lives in the file, not pinned here.

**[1.7] Seed test data (1 hour)**
Create a test coordinator account and test patient account.
Add one Patient record linked to the coordinator via PatientAccess.
Add one Episode for the patient (status: active, started_at: today).

Verify: log in as coordinator, confirm you can query the patient and episode via Supabase client.

### Evening (2 hours)

**[1.8] Basic layout shells (2 hours)**
- `app/(coordinator)/layout.tsx` — sidebar nav with patient name, episode status
- `app/(coordinator)/dashboard/[patientId]/page.tsx` — empty shell with correct data fetching
- `app/(patient)/patient/[patientId]/page.tsx` — empty shell

**Day 1 done when:**
- [ ] Can log in as coordinator
- [ ] Can log in as patient
- [ ] Both see their respective empty dashboard shells
- [ ] No TypeScript errors
- [ ] Supabase shows all 9 tables

---

## Day 2 — Components + File Upload (10–12 hours)

**Goal:** All primitive and composite components built. File upload to Vercel Blob working. No AI yet.

### Morning (4 hours) — Primitives

**[2.1] Install required Shadcn components (30 min)**
```bash
pnpm dlx shadcn@latest add badge card sheet button input label
pnpm dlx shadcn@latest add skeleton toast separator
```

Install Lucide (already included with Shadcn):
```bash
pnpm add lucide-react
```

**[2.2] Build all 4 primitives (2.5 hours)**
Work through COMPONENT_PLAN.md in order:
1. `components/primitives/DocumentTypeTag.tsx`
2. `components/primitives/EpisodeStatusBadge.tsx`
3. `components/primitives/TaskCategoryIcon.tsx`
4. `components/primitives/TranslationStatusIndicator.tsx`

**Visual verification rule:** each primitive must render correctly for all its possible values before moving on. Create a temporary `/test-components` route to verify visually.

**[2.3] Build 3 composites (1 hour)**
1. `components/composites/DocumentCard.tsx`
2. `components/composites/PendingTaskRow.tsx`
3. `components/composites/EpisodeStatusCard.tsx`

### Afternoon (4 hours) — File Upload

**[2.4] Vercel Blob setup (30 min) [NEW]**

```typescript
// lib/storage/blob.ts
import { put, head, del } from '@vercel/blob'

export async function uploadDocument(
  file: File,
  episodeId: string,
  documentId: string
): Promise<string> {
  const blob = await put(
    `documents/${episodeId}/${documentId}/${file.name}`,
    file,
    { access: 'private' }
  )
  return blob.pathname  // Store this, NOT blob.url
}

export async function getDocumentUrl(fileKey: string): Promise<string> {
  const { url } = await head(fileKey)
  return url
}
```

**[2.5] Document upload Server Action (1.5 hours) [NEW — Server Actions]**

```typescript
// actions/upload-document.ts
'use server'

export async function uploadDocument(formData: FormData) {
  // 1. Get file from formData
  // 2. Validate file type and size
  // 3. Create Document record in Supabase (status: pending_classification)
  // 4. Upload file to Vercel Blob → get file_key
  // 5. Update Document record with file_key
  // 6. Return { documentId, fileKey }
  // NOTE: Classification and translation happen separately (Day 3)
}
```

**[2.6] DocumentUploadZone component (1.5 hours)**
- Drag and drop area
- File picker fallback
- Progress indicator
- Calls upload-document Server Action
- Shows success/error state

**[2.7] Wire upload zone into dashboard (30 min)**
Add DocumentUploadZone to coordinator dashboard.
Verify: upload a test file, confirm it appears in Vercel Blob storage and as a Document record in Supabase.

### Evening (2 hours)

**[2.8] EpisodeTimeline feature component (2 hours)**
`components/features/EpisodeTimeline.tsx`
- Fetches documents from Supabase
- Renders DocumentCard for each
- Empty state
- No translation output yet — just the document cards

**Day 2 done when:**
- [ ] All 4 primitives render correctly for all values
- [ ] File upload creates a Document record in Supabase
- [ ] File appears in Vercel Blob dashboard
- [ ] EpisodeTimeline shows uploaded documents as cards

---

## Day 3 — AI Pipeline (10–12 hours)

**Goal:** Upload a document → classification + translation + episode summary all work end-to-end.

**Cost management before you start:**
Set `AI_MODEL_TIER=development` in `.env.local`. This routes all Claude calls to `claude-haiku-4-5-20251001` during Day 3 development — roughly 20× cheaper than Sonnet. Only switch to `AI_MODEL_TIER=production` (Sonnet) for the real document exit criteria test at Day 3 end and Day 5 testing. See `lib/ai/models.ts` and AI_BEHAVIOUR.md for the model map.

### Morning (4 hours) — Classification + Translation

**[3.1] Zod schemas (45 min)**
Create all three schemas from AI_BEHAVIOUR.md:
```typescript
// lib/ai/schemas.ts
export const ClassificationSchema = z.object({ ... })
export const TranslationSchema = z.object({ ... })
export const EpisodeSummarySchema = z.object({ ... })
```

**[3.2] Classification function (1 hour)**
```typescript
// lib/ai/classify.ts
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export async function classifyDocument(fileUrl: string) {
  const { object } = await generateObject({
    model: anthropic(AI_MODELS.classify),  // see lib/ai/models.ts — Haiku in dev, Sonnet in prod
    schema: ClassificationSchema,
    temperature: 0.0,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: CLASSIFICATION_PROMPT },
        { type: 'image', image: new URL(fileUrl) }
        // For PDFs: use document type instead of image
      ]
    }]
  })
  return object
}
```

**[3.3] Translation function (1 hour)**
```typescript
// lib/ai/translate.ts
export async function translateDocument(
  fileUrl: string,
  documentType: string,
  patientName: string
) {
  const { object } = await generateObject({
    model: anthropic(AI_MODELS.translate),  // Haiku in dev, Sonnet in prod
    schema: TranslationSchema,
    temperature: 0.1,
    messages: [{ ... }]
  })
  return object
}
```

**[3.4] Episode summary function (1 hour)**
```typescript
// lib/ai/summarise.ts
export async function regenerateEpisodeSummary(
  episodeId: string,
  patientName: string,
  translations: DocumentTranslation[]
) {
  const { object } = await generateObject({ ... })
  return object
}
```

### Afternoon (5 hours) — Wire It All Together

**[3.5] Update upload-document Server Action (2 hours)**
Extend the action from Day 2:
```typescript
// actions/upload-document.ts
export async function uploadDocument(formData: FormData) {
  // Day 2 steps 1-5 already done...

  // Step 6: Classify document
  const classification = await classifyDocument(fileUrl)

  // Step 7: Update Document record with classification
  await supabase.from('documents').update({
    type: classification.type,
    name: classification.suggested_name,
    purpose: classification.suggested_purpose,
    document_date: classification.document_date,
    source_hospital: classification.source_hospital,
    source_department: classification.source_department
  }).eq('id', documentId)

  // Step 8: Translate document
  const translation = await translateDocument(
    fileUrl, classification.type, patientName
  )

  // Step 9: Create DocumentTranslation record
  const { data: translationRecord } = await supabase
    .from('document_translations')
    .insert({ document_id: documentId, ...translation })

  // Step 10: Create DocumentAction records
  for (const action of translation.actions) {
    await supabase.from('document_actions').insert({
      translation_id: translationRecord.id,
      ...action
    })
  }

  // Step 11: Regenerate episode summary
  const allTranslations = await getAllTranslationsForEpisode(episodeId)
  const summary = await regenerateEpisodeSummary(
    episodeId, patientName, allTranslations
  )

  // Step 12: Upsert EpisodeSummary (create or update + increment version)
  await upsertEpisodeSummary(episodeId, summary)

  return { success: true }
}
```

**[3.6] TranslationOutputPanel (1.5 hours)**
`components/features/TranslationOutputPanel.tsx`
- Shadcn Sheet component
- Shows plain_language and what_it_means
- Shows DocumentAction items as read-only PendingTaskRow
- Coordinator vs patient view toggle (patient sees plain_language only)

**[3.7] EpisodeSummaryPanel (1.5 hours)**
`components/features/EpisodeSummaryPanel.tsx`
- Shows EpisodeStatusCard at top
- Visit purpose
- Timeline summary (collapsible)
- Open task count

### Evening (1 hour)

**[3.8] The real document test (1 hour)**
Upload dad's actual medical document.
Read the output.
Ask: could he read this and tell me what he needs to do tomorrow?
If no → identify the specific failure and fix the prompt.
Do not move to Day 4 until this test passes.

**Day 3 done when:**
- [ ] Upload a document → classification runs automatically
- [ ] Translation output appears on DocumentCard click
- [ ] EpisodeSummaryPanel updates after upload
- [ ] Real document test passes

---

## Day 4 — Two Views + Pending Tasks (10–12 hours)

**Goal:** Coordinator and patient views both work correctly. Pending tasks are visible and resolvable.

### Morning (4 hours) — Patient View

**[4.1] Patient dashboard (2 hours)**
`app/(patient)/patient/[patientId]/page.tsx`

Patient sees:
- Current status (EpisodeStatusCard — simplified)
- Plain language summary only
- Their documents — click to see plain_language explanation only
- No raw medical data, no task management

**[4.2] RLS policy review (1 hour)**
Verify patients can only read their own data.
Verify patients cannot write to any table.
Test by logging in as patient and attempting to access coordinator data directly via Supabase client.

**[4.3] Two-view conditional rendering (1 hour)**
```typescript
// Shared pattern for coordinator vs patient views
const { data: { user } } = await supabase.auth.getUser()
const access = await getPatientAccess(user.id, patientId)
// access.role === 'coordinator' → full view
// access.role === 'patient' → simplified view
```

### Afternoon (5 hours) — Pending Tasks

**[4.4] Pending tasks page (2 hours)**
`app/(coordinator)/dashboard/[patientId]/tasks/page.tsx`

- Lists all PendingTasks for episode
- Filtered by phase_appears (during_care vs post_discharge based on episode status)
- Grouped by category
- Each renders as PendingTaskRow with resolve button

**[4.5] Resolve task Server Action (1 hour)**
```typescript
// actions/resolve-task.ts
'use server'
export async function resolveTask(taskId: string, resolutionNote: string) {
  // Update status to 'resolved'
  // Set resolved_at to now()
  // Set resolution_note
}
```

**[4.6] Add pending tasks to EpisodeSummaryPanel (30 min)**
Show open task count per category as a quick visual summary.

**[4.7] Episode status management (1.5 hours)**
Allow coordinator to manually update episode status:
- active → care_complete (when doctor confirms medical clearance)
- care_complete → closed (when final bill settled and discharge complete)

When status changes to care_complete:
- Surface post_discharge tasks that were hidden during active phase

### Evening (1 hour)

**[4.8] End-to-end flow test (1 hour)**
Walk through the complete flow as both users:
1. Coordinator: upload 3 documents (prescription, lab report, discharge summary)
2. Verify all 3 translate correctly
3. Verify episode summary reflects all 3
4. Verify pending tasks appear correctly
5. Switch to patient view — verify simplified output
6. Resolve one task — verify it disappears from open list

**Day 4 done when:**
- [ ] Patient view shows only plain language — no raw data
- [ ] Coordinator can see and resolve pending tasks
- [ ] Phase-aware task filtering works (post-discharge tasks hidden while active)
- [ ] End-to-end flow works without errors

---

## Day 5 — Polish + Deploy + Test (10–12 hours)

**Goal:** V1 is live at a public URL. Real document test passes. The two non-developer testers can use it without explanation.

### Morning (4 hours) — Polish

**[5.1] Loading and empty states (1.5 hours)**
Every async operation needs a loading state.
Every empty list needs an empty state.
Use Shadcn Skeleton for loading. Write helpful empty state copy.

**[5.2] Error handling (1 hour)**
- Upload failure → clear error message + retry
- AI translation failure → clear error message + manual retry button
- Network error → toast notification
- Never show raw error messages to users

**[5.3] Mobile responsiveness check (1 hour)**
The coordinator is often on their phone in the hospital.
Test every page at 375px width.
Fix the most broken layouts.

**[5.4] TypeScript cleanup (30 min)**
Run `tsc --noEmit`. Fix all type errors. Zero type errors before deployment.
(If the Verification Loop was followed, this is a final confirmation — not a pile of
deferred errors. `tsc` is a per-change gate, not a Day-5 surprise.)

### Afternoon (4 hours) — Deploy

**[5.5] Production environment setup (1 hour)**
Add all environment variables to Vercel project settings.
Update NEXT_PUBLIC_APP_URL to production URL.

**[5.6] Deploy (30 min)**
```bash
git add .
git commit -m "feat: Patient Coordinator V1"
git push origin main
```
Vercel auto-deploys from main. Verify deployment succeeds.

**[5.7] Production smoke test (1 hour)**
Test the full flow on the live URL — not localhost.
Upload a real document.
Verify Claude responds correctly.
Verify both views work.

**[5.8] The three exit criteria test (1.5 hours)**

**Test 1 — Real document:**
Upload dad's blood test, prescription, and discharge summary.
Have him read the output on his phone.
Ask: what do you need to do tomorrow?
Pass = he answers correctly without you explaining.
Fail = fix the prompt, re-test.

**Test 2 — Non-developer user:**
Ask someone who has been a hospital coordinator (family member, friend, colleague) to open the live URL.
Give them zero instructions.
Watch what they do.
Pass = they find it useful within 5 minutes.
Fail = note exactly where they got stuck. Fix one thing. Re-test.

**Test 3 — Scope boundary:**
Can the product extract a medication schedule automatically?
Answer out loud: "No, that is V2. V1 translates documents into plain language. Medication extraction requires V2 because it needs to be accurate enough that no medication gets missed — and that accuracy level requires validating translation first."

### Evening (2 hours) — Content Capture

**[5.9] Build log capture (30 min)**
Answer the three daily questions for every day of the build:
1. What did I decide?
2. What resisted me?
3. What did I understand that I didn't before?

This is 5 days × 3 questions = 15 raw entries. The material for the first month of content.

**[5.10] First LinkedIn post (1.5 hours)**
Write the origin post: your dad's hospitalisation, the folder, the blood test report, the Googling, the waiting.
Not about tech. About the human problem.
Use the opening line you chose: "My dad had an operation last year. I was the one managing everything. I had no idea what I was doing."
Post it with the live URL at the bottom.

---

## Summary

| Day | Focus | Output |
|-----|-------|--------|
| 1 | Foundation | DB schema live, auth working, empty dashboards |
| 2 | Components + Upload | All primitives built, file upload to Blob working |
| 3 | AI Pipeline | Classification + translation + episode summary working |
| 4 | Two Views + Tasks | Coordinator and patient views, pending task resolution |
| 5 | Polish + Deploy | Live URL, real document test passes, first post published |

---

## What To Do When You Get Stuck

1. Read the relevant `.md` file first — the answer is probably there
2. Check if you're building something in Section 5 (what it does NOT do) — stop if yes
3. If the AI suggests something not in COMPONENT_PLAN.md — reject it, stay with primitives
4. If a prompt produces bad output — fix one thing at a time, re-test with real document
5. If a feature is taking too long — cut it from V1, note it for V2

The exit criteria are your north star. Everything else is secondary to those three tests.
