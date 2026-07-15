# CareAlign v2 — Rules Reference

> New session? Read `AGENTS.md` first — orientation, current status, anti-pattern cheat sheet.
> This file is the rules layer: what governs every code change. Design: `docs/SYSTEM_DESIGN.md`. Process: `docs/PRACTICES.md`. Sequence: `docs/BUILD_PLAN.md`.

---

## What we are building (one paragraph)

One family account (Netflix-style) holds profiles for each family member — no per-member logins, no roles. Members capture medical documents (photos/PDFs); AI **organizes and explains** them into a per-person timeline; the family retrieves the right record when a doctor asks (search + visit brief) and manages upcoming appointments. The wedge is **retrieval at the doctor-visit moment**, not storage.

## Stack

```
Next.js 16 App Router + React 19 + TypeScript (Turbopack)
Supabase (Postgres + Auth + RLS) — one auth user = one family
File storage: OPEN — DECISIONS.md D-003, resolve before any capture code
Claude via Vercel AI SDK v6 (generateText + Output.object)
Shadcn/UI + Tailwind v4 (role-free tokens: brand / accent / ai / success)
PostHog (analytics + replay + errors + flags), Resend (email)
```

**Next.js 16 vs. training data:** `proxy.ts` not `middleware.ts`; `cookies()`/`headers()`/route `params` are async; `useActionState` is `(_prev, formData)` — forgetting `_prev` silently shifts args. When unsure read `node_modules/next/dist/docs/`. Full list: `docs/ANTI_PATTERNS.md`.

Path alias `@/*` → repo root (no `src/`).

---

## Hard Rules — Do Not Violate

1. **Explain, never advise.** AI output describes what a document says and defines terms. It NEVER assesses severity, compares to norms, recommends actions, or interprets clinically. Advisory language in any AI output is a hard eval failure regardless of accuracy (`docs/PRACTICES.md` §6). This is the product's safety boundary and its legal one.

2. **Verbatim-or-null extraction.** Extracted fields (dates, names, medications, tests) are copied as written on the document or left `null`. Never inferred, normalized into existence, or defaulted (no upload-date-as-document-date, no empty strings). UI renders nulls honestly ("Date unknown").

3. **Capture is sacred.** Once a document is captured it is never deleted or hidden by the pipeline. AI failure → `status = 'needs_review'`, document stays visible with manual-fix affordance. Only the user deletes.

4. **No roles.** There is no coordinator, no patient-as-role, no permission tiers inside a family. One account = one family; profiles are people, not users. The words `coordinator`/`patient` are banned from identifiers, routes, tokens, and copy (a profile *is* somebody's medical record — "patient" as a clinical noun in AI extraction fields like `patient_name_as_written` is fine).

5. **`family_id` on every table + two-layer access control.** Every table carries denormalized `family_id`; RLS policies compare it to `current_family_id()` without joins. Every migration creating a table includes BOTH layers — `GRANT ... TO authenticated` / `GRANT ALL ... TO service_role` AND RLS policies for every verb used. A `.update()`/`.delete()` returning `{ error: null }` with 0 rows written means a missing policy — this silently failed 3 times in v1 (`docs/ANTI_PATTERNS.md` §1).

6. **No AI calls client-side.** All model calls run in Server Actions, Route Handlers, or `after()`. `ANTHROPIC_API_KEY` never reaches the browser.

7. **No raw storage URLs to the client.** Files are served through the authenticated document-file route, which checks family membership before returning a signed URL.

8. **Data fetching in pages/layouts goes through `lib/dal/` only.** No `supabase.from()` in `page.tsx`/`layout.tsx`; DAL functions are `cache()`-wrapped. `supabase.auth.getUser()` inline is fine (auth, not data). Layouts that render data check access themselves — never rely on child pages.

9. **Client components never import server actions.** Parent RSC injects them as props; stories use `fn()` from `storybook/test`. `import type` is allowed.

10. **DB-aligned union types live in one module** (`lib/types/domain.ts` when created) and are imported everywhere — never redefined inline.

11. **AI SDK structured output = `generateText + Output.object({ schema })`.** `generateObject`/`streamObject` are deprecated. Result: `result.experimental_output`. Error: `NoOutputGeneratedError`. FilePart uses `mediaType`.

12. **No hardcoded model strings.** Use the model map (`lib/ai/models.ts` when created); dev/prod tiers via env.

13. **Design tokens only.** No raw `oklch()`/`#hex`/`rgb()` in `className` or `style`. Namespaces: `brand`, `accent`, `ai`, `success` (see `app/globals.css`).

14. **No dependency or architectural choice without a `docs/DECISIONS.md` entry** — context, options table, choice, why, revisit trigger. `Status: OPEN` entries block the phase that needs them (D-003 blocks capture).

15. **V1 scope boundary.** NOT in V1 — do not build: medical advice of any kind, medication tracking/reminders-for-doses, regional-language UI, hospital/insurance discovery (V2), ABDM integration, per-profile logins, sharing outside the family, natural-language ask (V1.5, behind the north-star trigger).

---

## Enforcement

`pnpm lint:arch` (tsc + custom ESLint rules + check-stories) runs pre-commit (`.githooks`) and in CI. Red CI blocks the phase gate. Phase exit = `docs/PRACTICES.md` §8 checklist, run literally. Commits are layer-grouped (schema / dal / actions / enforcement / components / pages / docs) and **founder-confirmed — never auto-commit**.

## Stop Conditions

- New primitive component with no story pattern → propose interface + states, wait for sign-off.
- New action/form with no Zod schema → define schema first (`lib/validation/schemas.ts` when created).
- Any OPEN decision blocking the current step → resolve or escalate, don't assume.
- Anything that would widen scope past Rule 15 → flag it, don't build it.

## Key Docs

| Need | File |
|---|---|
| Full design (routes, schema, pipeline, diagrams) | `docs/SYSTEM_DESIGN.md` |
| Engineering process + phase-gate checklist + tracking plan | `docs/PRACTICES.md` |
| Decision records (stack choices + rationale) | `docs/DECISIONS.md` |
| Build sequence + exit criteria | `docs/BUILD_PLAN.md` |
| Anti-patterns (scar tissue) | `docs/ANTI_PATTERNS.md` |
| Claude Code workflow (subagents, models, skills) | `docs/AGENTIC_WORKFLOW.md` |
| Design review lens (Impeccable + PDP checklists) | `docs/DESIGN_REVIEW_LENS.md` |
| Session retro journal | `docs/CONTENT_LOG.md` |
| v1 documentation (read-only history) | `docs/archive/carealign-v1/` |
