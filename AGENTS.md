<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# CareAlign v2 — Agent Orientation

> Read this before writing any code. Deep rules → `CLAUDE.md`. Design → `docs/SYSTEM_DESIGN.md`. Sequence → `docs/BUILD_PLAN.md`.

---

## What This Is

A family's health history, organized and retrievable when the doctor asks. One account = one family (Netflix-style); family members are **profiles**, not users — no per-member logins, no roles. Capture a medical document → AI organizes and **explains** it (never advises) → it lands on that person's timeline → the family retrieves it via search or a printable **visit brief**, and manages upcoming appointments.

This is a **greenfield rebuild in the same repo**. v1 (coordinator/patient episode tool) was torn down 2026-07-15; its docs live read-only in `docs/archive/carealign-v1/`. The chassis survived: `components/ui/` primitives, the ESLint enforcement stack, `lib/{logger,ratelimit,utils,supabase}`, configs.

## Build Status (2026-09-09)

> This is the single source of truth for current build status — no other file (README.md, BUILD_PLAN.md) restates it; they point here instead.

**Phase 2 IN PROGRESS.** Landed so far: the organize contract (`OrganizeSchema` + atomic fact types, D-012), the model map, the explain-never-advise system prompt (versioned); the upload client (canvas re-encode ≤2000px longest edge, EXIF stripped/orientation applied); `createDocument` action (idempotent via unique-constraint replay); the signed-upload route with rate limiting live (10/hour/user, fails closed on an actual hit with 429, fails open + logs if Upstash itself is unreachable so an infra outage never blocks capture — Rule 3, ANTI_PATTERNS #13, tested in `__tests__/unit/uploads-sign-ratelimit.test.ts`); `storage.objects` RLS for the `documents` bucket, including a proof test and the family-scoped DELETE policy it found missing (ANTI_PATTERNS #11, #12); the `after()` organize step (`lib/ai/organize.ts`) wiring prompt + schema + model, with a provider-independent safety net (warnings logged, hard Zod boundary before any DB write). Verified end-to-end in a real browser for photo capture, PDF capture, and a full organize run producing correct structured output. **`AI_MODEL_TIER=development` now points at OpenAI `gpt-5-nano` (D-004, 2026-09-08) — genuinely schema-enforcing, ~$0.15/month at dogfood volume; needs `OPENAI_API_KEY` provisioned before it actually runs. Production tier (Anthropic vs. `gpt-5-mini`) is still an open, eval-decided question, deliberately deferred to just before production.** Also landed this phase: CI production-build gate, branch protection, restored Storybook coverage for `components/ui`, root/route error boundaries, numeric perf/a11y targets, auth error-masking fix; a Vercel Cron keepalive ping (`app/api/cron/keepalive`, twice a week) so Upstash's free-tier 14-day idle-deletion policy doesn't silently take out the rate limiter again, alerting to email via a free healthchecks.io dead-man's-switch since Vercel's own Alerts product needs a Pro plan this team doesn't have (D-015, ANTI_PATTERNS #14 — this is exactly what happened once already; a real incident on 2026-09-08 also caught and fixed a bug where a failed ping wasn't detectable in our own logs).

Timeline card states also landed (`components/features/DocumentCard.tsx`): Organizing… (skeleton, status='uploaded') / organized (filled, success-tinted) / needs-review (manual-details form via `updateDocumentDetails` + `retryOrganize` button) — all three verified live against real data, including a full needs_review → retry → organized round trip.

The file-serving route also landed (`app/api/documents/[documentId]/file/route.ts` + `getDocumentFile` in `lib/dal/documents.ts`): Hard Rule 7 — the client never receives a raw `blob_key`, only a link to this route, which checks family membership via RLS before minting a 60s signed URL and redirecting. Wired into `DocumentCard`'s organized and needs-review states as a "View file" link. Verified live: unauthenticated requests are redirected to `/login` by the auth proxy before reaching the route; an authenticated request for a real document resolves to a working signed Supabase Storage URL.

**The document detail page also landed** (`app/(app)/p/[profileId]/d/[documentId]/page.tsx` + `DocumentDetail` component, 2026-09-08): renders `document_explanations` — `what_it_says`, term definitions, medications and test results as written — which had been written by `organize()` since Phase 2 landed but shown on zero screens until now. Lab flags render neutral with an explicit "copied verbatim, never generated" caption (Hard Rule 1 / D-012). Also fixed a real bug found while building it: `patient_name_as_written` was extracted by the AI on every run but never persisted anywhere (`organize.ts`'s documents update omitted it) — a migration added the column and it's now written and rendered. Verified live in the browser against real captured documents, including the profile-mismatch defense (wrong profileId + valid documentId → 404).

Upload-failure client-side retry-with-backoff also landed (`lib/capture/with-retry.ts`, wired into `CaptureButton.tsx`): the sign+upload step and the `createDocument` call each retry transient failures (network exceptions, 5xx) up to 2 extra attempts with exponential backoff (500ms/1000ms) — a 4xx or an explicit domain error (`NonRetryableError`) fails fast instead of retrying. Sign+upload retries always re-sign rather than reusing a token. `createDocument` retries reuse one `idempotencyKey` generated before the retry loop, relying on the action's existing unique-constraint-replay path. Button shows "Retrying… (n/2)" during a retry. Verified live: a happy-path capture is unaffected; a fetch patched to fail twice on `/api/uploads/sign` was retried transparently and the document still captured and organized (server log shows only the one request that actually landed).

The AI eval harness also landed (`eval/run.mjs`, `lib/eval/score.ts`, `docs/PRACTICES.md` §6): scores field accuracy (split into fabrications vs. omissions) and a Hard-Rule-1 boundary check against three synthetic placeholder documents; `pnpm eval` (live) and `pnpm eval:smoke` (cached, CI-wired, no API key) both green. The boundary-check categories are grounded in verified Indian regulatory research, not just internal judgment — `docs/DECISIONS.md` D-014 is the research record, `docs/INDIA_COMPLIANCE.md` is the live rule checklist + enforcement pointers + draft user-facing trust copy. Two real false positives were found and fixed while building this (see D-014).

**Priority order to MVP, as currently decided (2026-09-08) — see `docs/private/` research (gitignored) for the fuller analysis behind this sequencing, and D-017/D-018 for the parts that are public:**
1. ~~Document detail page~~ — done, above.
2. ~~`storage.objects` RLS proof test~~ — done, 2026-09-08 (`__tests__/rls/storage-objects-rls-proof.test.ts`). Found and fixed a real gap in the same pass: the `documents` bucket had no DELETE policy at all, so no one — not just other families — could delete an uploaded file. Added the missing policy (`supabase/migrations/20260908000001_storage_documents_rls_delete.sql`, Rule 3), scoped to the owning family. UPDATE (in-place overwrite) is deliberately still ungranted — see that migration's comment. Building this also surfaced that `pnpm test` with no env exported could silently run these tests against **production** (`.env.local` holds this project's real credentials) — fixed with a dedicated `.env.test.local` + a hard refusal to run against a non-local URL (`lib/test/supabase-test-env.ts`, `pnpm test:env` to generate it).

   Also shipped the full delete-document feature end to end the same day, once the RLS layer made it safe to: `deleteDocument` server action (`actions/documents.ts` — deletes the row first, then the storage object, so a storage failure never leaves a document that's still listed but broken), a confirm-dialog `DeleteDocumentButton` on the document detail page, and Playwright verification of the real flow (capture → view → delete → confirm → redirect to timeline → 404 on the old URL → storage object actually gone) against a local Supabase instance.
3. ~~Event-date timeline ordering~~ — done, 2026-09-08, then corrected the same day while building real pagination (below): `documents_timeline_idx`'s own comment said queries "must use this exact expression" (`coalesce(document_date, captured_at at IST)::date`) but the ordering above didn't actually implement it — it ranked every dated document above every undated one regardless of true recency. Fixed with a generated `event_date` column on `documents` (`supabase/migrations/20260908000002_event_date_columns.sql`), a real indexed sort key.

**Phase 3 item 1 (timeline pagination) done, 2026-09-08 — documents-only, appointments deliberately deferred.** BUILD_PLAN.md's own spec calls for "documents ∪ appointments," and a manual `AppointmentForm` + `createAppointment` CRUD path was built and verified live before being cut in the same session: a manual-entry form asks a family to retype an appointment they already have in a calendar app or a clinic's own WhatsApp reminder, with no reminder-sending payoff to justify the new habit — exactly what `docs/DESIGN_REVIEW_LENS.md`'s own "old habits beat better products" line warns against. Built the feature because BUILD_PLAN named the word "appointments," not because a manual-entry form was checked against that principle first. The likely real shape of this feature: appointment/follow-up dates extracted from a captured document (a discharge summary's "follow up in 3 months," a doctor's note), the same verbatim-or-null way organize() already extracts other dates — not a second data-entry habit. Revisit before Phase 4 with that framing, not by resurrecting the deleted form.
- **`lib/dal/timeline.ts`**: keyset-paginated `documents` query by `event_date` desc, `id` as tiebreaker. Written generically enough to extend to a real union later; currently single-table.
- **`TimelineList`**: `IntersectionObserver`-driven "load more" via a thin `loadMoreTimelineItems` action, skeleton loading. Verified live in a real browser with real captured/organized documents paginating correctly by event date. The pagination boundary itself (a real second SQL page against ≥20 real rows) is only unit-tested (`__tests__/unit/dal-timeline.test.ts`), not yet proven against real Postgres data — no profile has that many real documents yet.
- Found and fixed two other bugs while building/testing this: `VisitBrief`'s date formatting relied on the runtime's default timezone rather than pinning `Asia/Kolkata` explicitly (invisible on a dev machine that happens to run in IST, wrong for a server or viewer anywhere else); and a `DESIGN.md` self-consistency bug where `VisitBrief`'s "upcoming" label used `ai-base` (reserved exclusively for AI-processing state per the Named Rule written that same day) instead of `accent-base` (documented as "the appointment/date accent" — kept even with manual appointment entry cut, since it's still correct guidance for whatever surfaces "upcoming" later).
- Thumbnails (aspect-ratio-reserved, zero CLS) not yet built.
4. ~~Bulk capture~~ — done, 2026-09-08. `CaptureButton`'s file input now takes `multiple`; files upload and organize one at a time (not in parallel — the sign route's per-user rate limit, 10/hour, is shared across the whole batch, and sequential processing lets a 429 stop the rest of the queue immediately instead of firing every remaining request into the same wall). Each file's `createDocument` call lands independently, so timeline cards for earlier files in the batch appear and organize while later files are still uploading. Verified live: 3 real documents selected in one picker, all 3 landed as separate "Organizing…" cards and organized independently and correctly — and rendered in the right order per the document_date fix in #3.
5. Load the founder's own family's real documents — doubles as the real eval set (see below). Not started — but a manual pipeline-check fixture set (`fixtures/dogfood/`, `docs/DOGFOOD_FIXTURES.md`, 2026-09-09) covering all 7 `doc_type`s (11 sourced Drlogy/NABH lab reports + discharge summary, 5 Claude-generated prescription/imaging/vaccination/bill/doctor-note documents) has been run end-to-end against production with correct verbatim-or-null extraction on every type. That's a stand-in for the real eval set, not a replacement for it — capture is now pleasant enough to do the real thing (#4 done).
6. Fill `expected.json` for 10–15 of those documents, run `pnpm eval` live on the new dev-tier model — not started.
7. ~~Search~~ — done, 2026-09-09, but a **simplified V1** against `docs/SYSTEM_DESIGN.md`'s own documented "Autocomplete extract" contract (§O, line ~143) and `docs/BUILD_PLAN.md`'s Phase 3 item 3 — not the full designed shape. `lib/dal/search.ts`'s `searchDocuments(profileId, query)` runs two `textSearch('search_tsv', query, { type: 'websearch' })` queries — one on `documents` (title/doctor_name/facility_name/doc_type), one on `document_explanations` (`what_it_says`) scoped to the profile via a PostgREST embedded-resource filter (`documents!inner(profile_id)`) — then merges, dedupes, and sorts by `event_date`. Deliberately two queries rather than one hand-built `.or()` filter string: unlike `timeline.ts`'s cursor filter (our own generated values), search input is free text a person typed, and a comma or paren in it would corrupt a raw PostgREST filter. `components/features/SearchableTimeline.tsx` wraps `TimelineList`, replacing it with live (300ms-debounced) results while a query is active — the debounce IS query-keyed (a `cancelled` flag guards each effect run, so a stale response from an abandoned keystroke can never overwrite a newer one). Verified live on the actual deployed Vercel site (not just localhost): a name mentioned only in an AI-composed explanation (not the document's own title/doctor/facility) still surfaced the right document; a no-match query and clearing back to the timeline both worked correctly.

   **Deliberately not built, still gaps against the documented contract:** `minQueryLength: 2` (current schema allows a 1-character query); results are not cached per query for the session (every debounce re-fetches, even a query typed before); the input is a plain `<Input type="search">`, not an ARIA combobox (no listbox, no `aria-expanded`/`aria-activedescendant`); no `autocorrect`/`autocapitalize`/`spellcheck` attributes set; no recent-documents empty state or `/` keyboard shortcut (BUILD_PLAN's mention). None of these are correctness bugs — the shipped version is safe and returns correct results — but revisit before calling Phase 3 item 3 fully done against its own spec.
8. Visit brief — not started. The actual hero feature.
9. Use it at one real doctor visit — the MVP exit criterion per `docs/BUILD_PLAN.md`'s own definition of done.

**Phase 3 started 2026-09-08, per `docs/BUILD_PLAN.md`'s own ordering rule ("design the last moment first" — mock the visit brief before the timeline, since the timeline exists to feed it):**
- **`DESIGN.md`** + `.impeccable/design.json` generated from the existing token system (`app/globals.css`) via the `impeccable` skill — north star "The Care Folder," with two rules worth knowing: the No-Severity Rule (color never signals medical severity — a "HIGH" lab flag stays plain ink text, matching Rule 1) and the Ring-Not-Shadow Rule (flat cards use a hairline ring, shadows reserved for sheets/dialogs — already how the code was built, now written down).
- **`components/features/VisitBrief.tsx`** — the visit brief mock: profile header, medications-as-written (each one source-cited back to the document it came from), latest document per type, appointments. Presentational only, fed by realistic mock data (`VisitBrief.stories.tsx`) — no DAL/action wiring yet, that's Phase 4's job. Print-friendly: verified live via Chromium print-media emulation that no color carries meaning a black-and-white printout would lose.
- Skipped writing a `PRODUCT.md` (the impeccable skill's own convention file) — its content already lives in `CLAUDE.md`/`docs/DECISIONS.md` D-017, and a second file restating the same facts would violate this project's own single-source-of-truth doc discipline.

**Deployment gap found and fixed, 2026-09-09 (ANTI_PATTERNS #15).** The three migrations from items #2/#3 above (`patient_name_as_written`, the storage DELETE policy, `event_date`) had been applied to the local Docker instance and committed to git, but never actually pushed to the production Supabase project `.env.local` points at — so the delete-document feature and the timeline had never been live for real users, and every real capture silently failed to organize. Found by dogfooding real documents (`docs/DOGFOOD_FIXTURES.md`) through the real app against the real environment; compounded by a second bug (`lib/dal/timeline.ts` discarding the query `error`, so the broken timeline rendered identically to an empty one — also fixed). `npx supabase db push` applied all three; re-verified live end to end (capture → organize → timeline → document detail → delete), all 7 `doc_type`s extracting correctly. `docs/PRACTICES.md` §8 now has an explicit `migration list` sync check (2a) to catch this going forward.

**Phase 2 not formally closed — explicit founder override, 2026-09-08.** `PRACTICES.md` §8's own checklist requires the real eval set (10–15 real documents, dogfooded) before a phase closes; that step is still undone (bulk capture above exists to make it painless, but doing it is a separate step). Flagged this conflict directly; founder chose to start Phase 3 now rather than dogfood first, so the real eval set is a carried-forward gap, not a forgotten one — priority items #5/#6 below still apply whenever it's picked back up.

**Still to build (Phase 2), not yet slotted into the sequence above:**
- **The real eval set's documents.** 10–15 user-supplied, anonymised family documents must replace the three synthetic placeholders in `eval/cases/` (`eval/cases/README.md`) — folded into step 5/6 above, since the founder's own dogfood capture produces them as a byproduct. The public-repo exposure risk is resolved (D-016).
- **Production model tier.** Anthropic vs. `gpt-5-mini` — deliberately deferred to just before production (founder decision, 2026-09-08); D-004 has the full cost/enforcement comparison ready when this is picked up.
- **Child-profile verifiable parental consent** (DPDP Act s.9) — no consent-capture step exists in profile creation today. Not a Phase 2 blocker — gates before the first non-family user, not before dogfooding with the founder's own family (`docs/INDIA_COMPLIANCE.md` item 7).

**Phase 1 CLOSED (PRACTICES §8 checklist run 2026-07-17).** Schema + RLS live on the wiped v1 Supabase project; D-003 resolved to Supabase Storage with spike data; PIN authority model in SYSTEM_DESIGN §D; PostHog wired (EU project 215321), all six events verified in live data; CI green including local-Supabase RLS proofs. Sequence and exit criteria: `docs/BUILD_PLAN.md`.

| Phase | What | Status |
|---|---|---|
| 0 | Teardown, docs, CI, chassis rename | done (2026-07-15) |
| 1 | Foundation: schema, RLS, auth, profiles, PostHog; D-003 resolved | done (2026-07-17) |
| 2 | Capture + organize pipeline + eval set | in progress (capture + organize + timeline cards built + browser-verified; file route + eval set next) |
| 3 | Timeline + retrieval (visit brief mocked FIRST) | in progress (visit brief mocked, `DESIGN.md` written, timeline pagination + a simplified search all done 2026-09-08/09; thumbnails + real DAL wiring for the visit brief next) |
| 4 | Visit brief + appointments + reminders | pending |
| 5 | Onboarding, landing, polish | pending |
| 6 | Dogfood with the users's family | pending |

**Blocked:** nothing currently.

## The Non-Negotiables (full list: CLAUDE.md)

1. **Explain, never advise** — advisory language in AI output is a hard failure.
2. **Verbatim-or-null** — extracted fields are copied as written or left null, never inferred.
3. **Capture is sacred** — pipeline failure sets `needs_review`; documents are never hidden/deleted by code.
4. **No roles** — `coordinator`/`patient` (as a role) are banned words in identifiers, routes, and copy.
5. **Two-layer access control** — every table: GRANTs AND RLS policies, `family_id` denormalized everywhere.

## Anti-Pattern Quick Reference

What AI instinctively reaches for that is wrong in this stack (details: `docs/ANTI_PATTERNS.md`):

| Don't | Do instead | Why |
|-------|-----------|-----|
| `middleware.ts` | `proxy.ts` | Renamed in Next 16 |
| Sync `cookies()` / `params.id` | `await cookies()` / `await params` | Async in Next 16 |
| `useActionState((formData) => …)` | `(_prev, formData) => …` | Silent arg shift, no type error |
| `generateObject()` / `streamObject()` | `generateText + Output.object({ schema })` | Deprecated in AI SDK v6 |
| `mimeType` on FilePart | `mediaType` | AI SDK v6 rename |
| `NoObjectGeneratedError` | `NoOutputGeneratedError` | Renamed alongside |
| `getSession()` | `getUser()` | Validates the JWT, not just the cookie |
| `supabase.from()` in pages/layouts | `lib/dal/*.ts` | DAL boundary, lint-enforced |
| `import { action }` in `'use client'` | Inject as prop from RSC parent | Lint-enforced |
| Inline union of a DB enum | Import from the domain types module | Lint-enforced |
| Raw `#hex`/`oklch()` in className | Token classes (`brand`/`accent`/`ai`/`success`) | Lint-enforced |
| New package without decision record | `docs/DECISIONS.md` entry first | PRACTICES §2 |

## Working Agreements

- **Never auto-commit.** Show the plan, ask "Ready to commit?", wait.
- **Questions over assumptions** — an OPEN decision entry or a direct question, never a silent default.
- **Deviation from the wedge gets flagged in the moment** (`docs/analysis/05-direction.md` is the wedge of record).
- Subagent/model policy and skills map: `docs/AGENTIC_WORKFLOW.md`.

## Gate Before Every Commit

```bash
pnpm lint:arch   # tsc --noEmit + custom ESLint rules + check-stories
pnpm test        # vitest
```

Pre-commit hook runs `lint:arch` automatically (`.githooks`, activated by `pnpm install` → `prepare`). Phase exit: `docs/PRACTICES.md` §8 checklist, literally.
