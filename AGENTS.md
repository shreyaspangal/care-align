<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# CareAlign — Agent Orientation

> Read this before writing any code. Two minutes here prevents discovering hard-won rules the slow way.
> Deep rules → `CLAUDE.md`. Architecture decisions → `docs/ARCHITECTURE.md`. Everything else → `docs/`.

---

## What This Is

A coordinator uploads medical documents from an active hospitalisation. Claude classifies and translates each one into plain language — producing a living episode summary that both the coordinator and the patient can read.

One route tree, one login. "Coordinator" is a permission on a specific patient record (`patient_access.role`), not an account type — the same person can hold full access to one relative's record and read-only access to their own, at the same time. See `docs/ARCHITECTURE.md` ADR-013.

---

## Build Status (2026-07-02)

V1 is **feature-complete**. Every phase in `docs/BUILD_PLAN.md` has shipped, plus a foundation-phase rework moving from account-level to per-record access (ADR-013).

| Feature | Status |
|---------|--------|
| Auth (login / register / logout) | ✓ Done |
| Unified dashboard shell + sidebar nav (any role) | ✓ Done |
| Patient invite flow (`/join/[token]`) | ✓ Done |
| Document upload → AI classify → translate | ✓ Done |
| Episode summary + tasks | ✓ Done |
| Per-record patient view (read-only) + Access tab (bilateral revocation) | ✓ Done |
| Enforcement stack (8 ESLint rules + pre-commit) | ✓ Done |

**Next work unit:** Determine next direction — candidates are an "invite a second coordinator" flow (self-revoke is currently a near-universal no-op without one) and the onboarding-checklist UI (`docs/ONBOARDING_RESEARCH.md`).

---

## The 5 Silent-Failure Rules

These return `{ error: null }` while writing nothing. No type error. No crash. Just 0 rows updated.

**1. RLS and GRANT are separate layers.**
A `.update()` or `.delete()` that returns success but writes 0 rows means the table has no RLS UPDATE/DELETE policy — even if the column-level GRANT exists. After writing any `.update()` or `.delete()`, grep migrations for `FOR UPDATE` or `FOR DELETE` on that table. If absent, the operation silently fails.

**2. Chicken-and-egg on patient creation.**
RLS on `patients` requires a `patient_access` row to exist. But that row can't exist before the patient is created. Fix: use `createServiceClient()` (service role, bypasses RLS) for the initial `patients` insert, then immediately insert `patient_access`. All subsequent queries use `createClient()` and RLS applies correctly from that point.

**3. Episode summary version counter.**
Plain `.upsert()` on `episode_summaries` resets the version counter to 1. Always use `upsertEpisodeSummary()` from `lib/db/episode-summaries.ts`, which calls the `upsert_episode_summary` RPC.

**4. `getUser()` not `getSession()`.**
`getSession()` trusts the session cookie without validating it with Supabase Auth servers. `getUser()` validates the JWT. Use `getUser()` in `proxy.ts`, server actions, and route handlers.

**5. Store `blob.pathname`, never `blob.url`.**
The URL is not stable across Blob store migrations. Only store the `pathname`. Reconstruct a fresh signed URL at read time via `lib/storage/blob.ts`.

---

## Anti-Pattern Quick Reference

What AI instinctively reaches for that is wrong in this stack:

| Don't | Do instead | Why |
|-------|-----------|-----|
| `middleware.ts` | `proxy.ts` | Renamed in Next 16 |
| `generateObject()` | `generateText + Output.object({ schema })` | Deprecated in AI SDK v6 |
| `streamObject()` | Not used in V1 | Deprecated in AI SDK v6 |
| `getSession()` | `getUser()` | Validates JWT, not just cookie |
| `mimeType` on `FilePart` | `mediaType` | AI SDK v6 renamed the field |
| `NoObjectGeneratedError` | `NoOutputGeneratedError` | Renamed alongside the deprecated API |
| Store `blob.url` in DB | Store `blob.pathname` | URL is not stable |
| Sync `cookies()` call | `const store = await cookies()` | Next 16: `cookies()` is async |
| `supabase.from()` in `page.tsx` / `layout.tsx` | `lib/dal/*.ts` functions | Hard Rule 12, enforced by lint |
| `import { action }` in `'use client'` files | Inject action as prop from RSC parent | Hard Rule 11, enforced by lint |
| Inline `type DocumentType = 'prescription' \| ...` | `import { DocumentType } from '@/lib/types/domain'` | Hard Rule 13, enforced by lint |
| `params.id` in route handlers | `const { id } = await params` | Next 16: `params` is a Promise |
| Plain `.upsert()` on `episode_summaries` | `upsertEpisodeSummary()` RPC wrapper | Resets version counter |

Full context and worked examples for each: `docs/ANTI_PATTERNS.md`.

---

## Navigation

| Need | Go to |
|------|-------|
| All 14 hard rules (the law) | `CLAUDE.md` |
| Architecture decisions (ADRs 001–012) | `docs/ARCHITECTURE.md` |
| Full Postgres schema + RLS policies | `docs/DATA_MODEL.md` |
| AI prompts + Zod schemas | `docs/AI_BEHAVIOUR.md` |
| Component catalogue + prop types | `docs/COMPONENT_PLAN.md` |
| Form handling contract | `docs/FORMS.md` |
| Testing plan | `docs/TESTING.md` |
| Daily decisions journal | `docs/CONTENT_LOG.md` |

---

## Stop Conditions

Stop and wait for sign-off before writing code if:
- A new component is needed with no existing story pattern
- A Shadcn primitive is missing from `components/ui/`
- A new action or form has no schema in `lib/validation/schemas.ts`

---

## Gate Before Every Commit

```bash
pnpm lint:arch   # tsc --noEmit + eslint (8 custom carealig/ rules) + check-stories
pnpm test        # unit + integration tests
```

The pre-commit hook runs `pnpm lint:arch` automatically — activated via `pnpm install` → `prepare` script.
