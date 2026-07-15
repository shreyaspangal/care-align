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

This is a **greenfield rebuild in the same repo**. v1 (coordinator/patient episode tool) was torn down 2026-07-15; its docs live read-only in `docs/archive/carealign-v1/`. The chassis survived: `components/ui/` primitives, the ESLint enforcement stack, `lib/{logger,ratelimit,utils,storage,supabase}`, configs.

## Build Status (2026-07-15)

**Phase 0 (reset) in progress.** Nothing of v2 is built yet. Sequence and exit criteria: `docs/BUILD_PLAN.md`.

| Phase | What | Status |
|---|---|---|
| 0 | Teardown, docs, CI, chassis rename | ← in progress |
| 1 | Foundation: schema, RLS, auth, profiles; resolve D-003 (file storage) | pending |
| 2 | Capture + organize pipeline + eval set | pending |
| 3 | Timeline + retrieval (visit brief mocked FIRST) | pending |
| 4 | Visit brief + appointments + reminders | pending |
| 5 | Onboarding, landing, polish | pending |
| 6 | Dogfood with the founder's family | pending |

**Blocked on founder:** PostHog project creation; new Supabase project credentials (Phase 1); D-003 spike sign-off.

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
