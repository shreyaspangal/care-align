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

## Build Status (2026-09-06)

> This is the single source of truth for current build status — no other file (README.md, BUILD_PLAN.md) restates it; they point here instead.

**Phase 2 IN PROGRESS.** Landed so far: the organize contract (`OrganizeSchema` + atomic fact types, D-012), the model map, the explain-never-advise system prompt (versioned); the upload client (canvas re-encode ≤2000px longest edge, EXIF stripped/orientation applied); `createDocument` action (idempotent via unique-constraint replay); the signed-upload route with rate limiting live (10/hour/user, fails closed on an actual hit with 429, fails open + logs if Upstash itself is unreachable so an infra outage never blocks capture — Rule 3, ANTI_PATTERNS #13, tested in `__tests__/unit/uploads-sign-ratelimit.test.ts`); `storage.objects` RLS for the `documents` bucket (ANTI_PATTERNS #11, #12); the `after()` organize step (`lib/ai/organize.ts`) wiring prompt + schema + model, with a provider-independent safety net (warnings logged, hard Zod boundary before any DB write). Verified end-to-end in a real browser for photo capture, PDF capture, and a full organize run producing correct structured output. **`AI_MODEL_TIER=development` currently points at a free OpenRouter model — dev-only, must switch to Anthropic/OpenAI before the eval set or any pre-launch testing (DECISIONS.md D-004 hard gate)**, see D-004 for the full research on why. Also landed this phase: CI production-build gate, branch protection, restored Storybook coverage for `components/ui`, root/route error boundaries, numeric perf/a11y targets, auth error-masking fix; a Vercel Cron keepalive ping (`app/api/cron/keepalive`, twice a week) so Upstash's free-tier 14-day idle-deletion policy doesn't silently take out the rate limiter again, alerting to email via a free healthchecks.io dead-man's-switch since Vercel's own Alerts product needs a Pro plan this team doesn't have (D-015, ANTI_PATTERNS #14 — this is exactly what happened once already).

Timeline card states also landed (`components/features/DocumentCard.tsx`): Organizing… (skeleton, status='uploaded') / organized (filled, success-tinted) / needs-review (manual-details form via `updateDocumentDetails` + `retryOrganize` button) — all three verified live against real data, including a full needs_review → retry → organized round trip.

The file-serving route also landed (`app/api/documents/[documentId]/file/route.ts` + `getDocumentFile` in `lib/dal/documents.ts`): Hard Rule 7 — the client never receives a raw `blob_key`, only a link to this route, which checks family membership via RLS before minting a 60s signed URL and redirecting. Wired into `DocumentCard`'s organized and needs-review states as a "View file" link. Verified live: unauthenticated requests are redirected to `/login` by the auth proxy before reaching the route; an authenticated request for a real document resolves to a working signed Supabase Storage URL.

Upload-failure client-side retry-with-backoff also landed (`lib/capture/with-retry.ts`, wired into `CaptureButton.tsx`): the sign+upload step and the `createDocument` call each retry transient failures (network exceptions, 5xx) up to 2 extra attempts with exponential backoff (500ms/1000ms) — a 4xx or an explicit domain error (`NonRetryableError`) fails fast instead of retrying. Sign+upload retries always re-sign rather than reusing a token. `createDocument` retries reuse one `idempotencyKey` generated before the retry loop, relying on the action's existing unique-constraint-replay path. Button shows "Retrying… (n/2)" during a retry. Verified live: a happy-path capture is unaffected; a fetch patched to fail twice on `/api/uploads/sign` was retried transparently and the document still captured and organized (server log shows only the one request that actually landed).

The AI eval harness also landed (`eval/run.mjs`, `lib/eval/score.ts`, `docs/PRACTICES.md` §6): scores field accuracy (split into fabrications vs. omissions) and a Hard-Rule-1 boundary check against three synthetic placeholder documents; `pnpm eval` (live) and `pnpm eval:smoke` (cached, CI-wired, no API key) both green. The boundary-check categories are grounded in verified Indian regulatory research, not just internal judgment — `docs/DECISIONS.md` D-014 is the research record, `docs/INDIA_COMPLIANCE.md` is the live rule checklist + enforcement pointers + draft user-facing trust copy. Two real false positives were found and fixed while building this (see D-014).

**Still to build (Phase 2):**
- **The real eval set.** 10–15 founder-supplied, anonymised family documents must replace the three synthetic placeholders in `eval/cases/` before any score is evidence about model quality (`eval/cases/README.md`). **Open decision, must be resolved before this happens:** this repo is public — committing real documents here risks permanent public PHI on one missed redaction (`docs/INDIA_COMPLIANCE.md` item 6).
- **`AI_MODEL_TIER` swap.** Still points at a free dev-tier OpenRouter model — must move to a schema-enforcing provider (Anthropic/OpenAI) before the eval set is run for real scoring or any pre-launch testing (DECISIONS.md D-004 hard gate).
- **Child-profile verifiable parental consent** (DPDP Act s.9) — no consent-capture step exists in profile creation today (`docs/INDIA_COMPLIANCE.md` item 7).

**Phase 1 CLOSED (PRACTICES §8 checklist run 2026-07-17).** Schema + RLS live on the wiped v1 Supabase project; D-003 resolved to Supabase Storage with spike data; PIN authority model in SYSTEM_DESIGN §D; PostHog wired (EU project 215321), all six events verified in live data; CI green including local-Supabase RLS proofs. Sequence and exit criteria: `docs/BUILD_PLAN.md`.

| Phase | What | Status |
|---|---|---|
| 0 | Teardown, docs, CI, chassis rename | done (2026-07-15) |
| 1 | Foundation: schema, RLS, auth, profiles, PostHog; D-003 resolved | done (2026-07-17) |
| 2 | Capture + organize pipeline + eval set | in progress (capture + organize + timeline cards built + browser-verified; file route + eval set next) |
| 3 | Timeline + retrieval (visit brief mocked FIRST) | pending |
| 4 | Visit brief + appointments + reminders | pending |
| 5 | Onboarding, landing, polish | pending |
| 6 | Dogfood with the founder's family | pending |

**Blocked on founder:** nothing currently.

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
