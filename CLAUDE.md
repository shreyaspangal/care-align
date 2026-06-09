# Patient Coordinator — AI Build Assistant Context

This file is read at the start of every AI-assisted coding session. It gives enough context to work correctly without re-reading all the docs.

---

## What This Product Does

A coordinator uploads medical documents (prescriptions, lab reports, bills, discharge summaries) from an active hospitalisation. Claude classifies and translates each one into plain language. The result is a living episode summary that both the coordinator and the patient can read and understand.

Two users. One data model. Different views.

---

## Stack

```
Next.js 16 App Router + React 19.2 + TypeScript   (Turbopack default)
Supabase (Postgres + Auth + RLS)
Vercel Blob (private file storage)
Claude API via Vercel AI SDK (structured output + Zod)
Shadcn/UI (radix-nova) + Tailwind v4
Upstash Redis (rate limiting)
Deployed on Vercel
```

### Next.js 16 — breaking changes vs. training data (READ FIRST)

This is Next **16**, not 15. `AGENTS.md` warns the same. The traps that bite:

1. **`cookies()` / `headers()` are async-only.** `await cookies()`. `lib/supabase/server.ts`
   `createClient()` is `async`; every caller does `const supabase = await createClient()`.
2. **No `middleware.ts` — it's `proxy.ts`.** Export `function proxy(request)`, runs `nodejs`
   runtime (not edge). Config flags renamed (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`).
3. **Dynamic route `params` is a Promise.** `async function GET(req, { params }: { params: Promise<{ id: string }> })`
   then `const { id } = await params`. Same for `page.tsx` props.
4. **`revalidateTag` needs a `cacheLife` arg**; new `updateTag`/`refresh` exist for Server Actions.

Path alias `@/*` → repo root (no `src/`). When unsure, read `node_modules/next/dist/docs/`.

---

## Key Files and Where Things Live

| What | Where |
|------|-------|
| All architectural decisions (ADRs) | `docs/ARCHITECTURE.md` |
| Full Postgres schema + RLS policies | `docs/DATA_MODEL.md` |
| AI prompts, Zod schemas, model config | `docs/AI_BEHAVIOUR.md` |
| Component definitions and prop types | `docs/COMPONENT_PLAN.md` |
| Day-by-day build sequence | `docs/BUILD_PLAN.md` |
| Testing plan + CI setup | `docs/TESTING.md` |
| Model map (Haiku dev / Sonnet prod) | `lib/ai/models.ts` |
| File validation logic | `lib/storage/validate.ts` |
| Rate limiter | `lib/ratelimit.ts` |
| Authenticated Blob file serving | `app/api/documents/[documentId]/file/route.ts` |
| Episode summary upsert (version-safe) | `lib/db/episode-summaries.ts` |
| Auth trigger for profile creation | `supabase/migrations/` |

---

## Hard Rules — Do Not Violate

1. **No Claude calls client-side.** All AI calls happen in Server Actions or API Routes only. `ANTHROPIC_API_KEY` never reaches the browser.

2. **No raw Blob URLs returned to client.** Files are served through `/api/documents/[documentId]/file` which enforces RLS before returning a signed URL.

3. **Use `AI_MODELS.classify/translate/summarise` from `lib/ai/models.ts`.** Never hardcode a model string. `AI_MODEL_TIER=development` uses Haiku, `production` uses Sonnet.

4. **Components are built from the existing primitive layer.** Do not create new primitive components without updating `docs/COMPONENT_PLAN.md`. When building composites or features, use only: `DocumentTypeTag`, `EpisodeStatusBadge`, `TaskCategoryIcon`, `TranslationStatusIndicator`.

5. **Supabase table is `profiles`, not `users`.** Auth is in `auth.users`. The public schema has `profiles` which references `auth.users(id)`. All application queries go to `profiles`.

6. **`document.status` drives the upload pipeline.** Transitions: `pending_classification` → `classified` → `translated`. Failure at any step sets `status = 'failed'` and returns — never deletes the record.

7. **`episode_summaries.version` increments via the `upsert_episode_summary` RPC.** Do not use a plain `.upsert()` — it will reset the version counter. See `lib/db/episode-summaries.ts`.

8. **`document_date` and `purpose` and `source_hospital` are nullable.** Claude may not be able to extract them. The UI shows "Date unknown" / "Processing..." — it never defaults to upload date or empty string.

9. **Silence is valid.** `actions: []` is a correct translation output. Do not add logic to manufacture tasks when Claude returns none.

10. **V1 scope boundary.** These are NOT in V1 — do not build them:
    - Automatic medication extraction
    - Hospital system integration
    - Regional language support
    - Voice interaction
    - ABDM / Eka Care integration (unless API access arrives before ship)

---

## Data Model — Quick Reference

```
auth.users (Supabase Auth)
  └─► profiles (id, name, role, preferred_language)
        └─(patient_access)─► patients
                                └─► episodes
                                      ├─► documents
                                      │     └─► document_translations (prompt_version)
                                      │               └─► document_actions
                                      ├─► episode_summaries (version, updated_at)
                                      └─► pending_tasks (source_action_id nullable)
```

RLS enforces: coordinator = full read/write, patient = read-only on translations + summaries + tasks only.

### Three concepts that look similar but are not

| Concept | Table | Contains | Created by |
|---------|-------|----------|------------|
| Authentication | `auth.users` (Supabase-managed) | email, password hash, session | Supabase on signup |
| Profile | `profiles` | name, role, language | `handle_new_user` trigger — automatic |
| Access grant | `patient_access` | user_id + patient_id + role | coordinator explicitly, per patient |

`profiles.role` = what kind of user they signed up as (their default).
`patient_access.role` = what they are **for a specific patient** (coordinator or patient of that record).
These can differ — a coordinator of one patient could be a patient in another record.

### Enum types — what they belong to

| Working on… | Relevant enums | Table |
|-------------|---------------|-------|
| Auth / login / signup | `user_role`, `preferred_language` | `profiles`, `patient_access` |
| Patient record | `admission_status` | `patients` |
| Episode lifecycle | `episode_status` | `episodes` |
| Document upload + AI pipeline | `document_type`, `document_status` | `documents` |
| AI output — actions | `action_for`, `action_status` | `document_actions` |
| Task list | `task_category`, `task_phase`, `task_status` | `pending_tasks` |

### Navigation — where to look when confused

| Question | Go to |
|----------|-------|
| What fields does a table have? | `supabase/migrations/20240101000000_initial_schema.sql` — Section 3 |
| Who can read/write this table? | Same file — Section 5 (search `ALTER TABLE <name> ENABLE`) |
| How does a new user get a profile? | Same file — Section 4 (`handle_new_user` trigger) |
| How does version increment safely? | Same file — Section 6 (`upsert_episode_summary` RPC) + `lib/db/episode-summaries.ts` |
| Full ER diagram with rationale | `docs/DATA_MODEL.md` |
| Which component uses which data? | `docs/COMPONENT_PLAN.md` |
| AI pipeline step order | This file — AI Pipeline section above |

---

## AI Pipeline — Step Order

```
validate file (MIME + size) → rate limit check → upload to Vercel Blob
→ create Document (status: pending_classification)
→ Claude: classify → update Document (status: classified)
→ Claude: translate → create DocumentTranslation + DocumentActions (status: translated)
→ Claude: regenerate EpisodeSummary (non-fatal — failure keeps previous version)
```

If any step throws: set `document.status = 'failed'`, return error to UI, do not delete the record.

---

## Testing — What Runs Where

| Suite | Command | Uses real Claude? | Runs in CI |
|-------|---------|------------------|------------|
| Unit + integration | `pnpm test` | No (MSW) | Every PR |
| E2E (Playwright) | `pnpm test:e2e` | No | After unit pass |
| AI fixtures + boundary | `pnpm test:ai` | Yes | Main branch only |

RLS integration tests use the test Supabase project. Seed data lives in `scripts/seed-test-db.ts`.

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server only
BLOB_READ_WRITE_TOKEN=           # server only
ANTHROPIC_API_KEY=               # server only
UPSTASH_REDIS_REST_URL=          # server only
UPSTASH_REDIS_REST_TOKEN=        # server only
NEXT_PUBLIC_APP_URL=
AI_MODEL_TIER=development        # 'development' = Haiku, 'production' = Sonnet
```
