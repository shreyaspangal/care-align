# CareAlign v2 — Build Plan

> Executes `docs/SYSTEM_DESIGN.md`. Phases are strictly sequential; each ends with the exit gate before the next begins. Renamed to `BUILD_PLAN.md` during Phase 0 when the v1 docs are archived.

**Exit gate (every phase): the PRACTICES.md §8 checklist, run literally** — CI green (tsc/lint:arch/tests/stories + RLS proofs + evals as they come online), tracking-plan events verified, diagrams current, DECISIONS.md updated, dogfooded, CONTENT_LOG retro, layer-grouped commits with founder confirmation, clean status. UI phases (3–5) additionally run the DESIGN_REVIEW_LENS.md checklist. Workflow (skills, subagents, models) per AGENTIC_WORKFLOW.md.

**Definition of done for V1:** the founder's own family — every member a profile, every existing document captured — and one real doctor visit where the visit brief answered a question. Not a feature list; a lived moment.

---

## Phase 0 — Teardown & rechristen (~½ day)

The one destructive phase. Everything here is a `git rm`, so it's fully reversible via history.

1. **Archive v1 product docs** → `docs/archive/carealign-v1/`: SPEC, ARCHITECTURE, DATA_MODEL, AI_BEHAVIOUR, COMPONENT_PLAN, BUILD_PLAN, ROADMAP, TESTING, FORMS, ANTI_PATTERNS. Research docs (ONBOARDING_RESEARCH, PRIVACY_TRUST_RESEARCH, `analysis/`, `research/`) stay live — still true. ANTI_PATTERNS gets a fresh v2 file seeded with the v1 entries that remain relevant (Supabase two-layer, Next 16 gotchas, AI SDK patterns).
2. **Delete the app layer** (99 files): `app/`, `actions/`, `components/features`, `components/composites`, `lib/dal`, `lib/ai`, `lib/types`, `lib/validation`, `supabase/migrations`, stale `ds-bundle` artifacts, `hooks/` (empty).
3. **Keep untouched:** `components/ui`, `lib/supabase`, `lib/logger.ts`, `lib/ratelimit.ts`, `lib/storage`, `eslint.config.mjs`, `scripts/`, `.githooks`, Storybook config, all root config.
4. **Design tokens:** rename `brand`/`patient`/`ai` namespaces to role-free equivalents in `globals.css` + the `carealig/no-raw-color-values` rule's allowlist.
5. **Rewrite CLAUDE.md + AGENTS.md** for v2: keep the enforcement/Supabase/Next-16/commit rules; replace product rules with v2 Hard Rules — (a) **explain-never-advise** (no AI output may interpret severity, suggest actions, or compare to norms), (b) family/profile model — the words coordinator/patient are banned in code, (c) capture is sacred (uploaded bytes always yield a visible timeline entry), (d) verbatim-or-null extraction, (e) `family_id` on every table + two-layer GRANT/RLS.
6. ~~New Supabase project~~ **Wipe and reuse the v1 Supabase project** (founder-decided 2026-07-15: v1 test data is disposable; same credentials, zero new setup). The wipe — drop all v1 tables/functions/policies + delete test auth users — is Phase 1 step 0, immediately before the baseline migration. Update `.env.local` / `.env.example`; minimal `app/` shell (`/` placeholder) so the repo builds.
7. **CI before features:** GitHub Actions workflow (PRACTICES §5 chain) on `shreyaspangal/care-align` — must be green on the teardown commit itself.
8. **Tooling:** install Impeccable (`npx impeccable install`); founder creates a **CareAlign PostHog project** (separate from work projects) and drops the key in `.env.local`.
9. Rename `BUILD_PLAN_V2.md` → `BUILD_PLAN.md` (old one archived in step 1).

**Gate + commits:** docs archive / deletion / config-tokens / CI / CLAUDE.md — separate commits.

## Phase 1 — Foundation: schema, auth, family & profiles (~1–2 days)

0. **Wipe v1 remains from the reused Supabase project** — drop public-schema tables/functions/types, remove v1 storage objects if any, delete test auth users. Founder confirms before execution (destructive).
1. **Baseline migration** (single file, the only schema source): enums; `families`, `profiles`, `documents`, `document_explanations`, `appointments`; `current_family_id()` security-definer helper; RLS (`family_id = current_family_id()` on every table) + **GRANTs in the same migration**; `search_tsv` generated column + GIN index + `pg_trgm`; unique `idempotency_key`.
2. `lib/types/domain.ts` (v2 unions: `DocumentStatus`, `DocType`, `AppointmentStatus`) + `lib/validation/schemas.ts` (Zod, single source).
3. **Auth:** `(auth)/register` (creates auth user + `families` row via service client), `(auth)/login`, `proxy.ts` (session refresh; `/` → `/profiles` when authed).
4. **Profiles:** picker screen (Netflix-style grid), add/edit profile, PIN set + unlock action (bcrypt, short-lived signed cookie), lock badge.
5. **DAL:** `getFamily`, `getProfiles`, profile helpers — `cache()`-wrapped.
6. **Resolve D-003** (file storage: Supabase Storage vs Vercel Blob) — the ≤2h spike per DECISIONS.md; capture build is blocked until this closes.
7. **PostHog wiring:** client + server SDK, first tracking-plan events (`profile_created`), error capture, web vitals.

**Test focus:** RLS proof-test (second Supabase user cannot read family A's rows — the v1 silent-failure lesson, now automated); Zod schema units.

## Phase 2 — Capture pipeline (~2–3 days) — the heart

1. **Upload client:** camera/file input → canvas re-encode (compress, longest-edge 2000px, **EXIF stripped, orientation applied**) → Vercel Blob client upload via token route → store `width/height`.
2. **`createDocument` action:** blob key + client idempotency key → `documents` row (`status='uploaded'`) → instant response; rate limit (Upstash) on the token route.
3. **AI organize in `after()`:** one `generateText + Output.object(OrganizeSchema)` call (classify + extract + explain + `patient_name_as_written`); write `document_explanations`; `status='organized'`. Any failure → `status='needs_review'` (document stays visible).
4. **Timeline card states:** Organizing… → organized (filled) → needs-review (manual-details form + `retryOrganize`). Upload failure keeps the local file with a backoff-capped retry button.
5. **File serving route:** auth check → 302 signed Blob URL (v1 pattern).
6. **Prompt:** explain-never-advise hard-constrained; verbatim-or-null; store `prompt_version`.

**Test focus:** an **eval set** — 10–15 real family documents (founder-supplied, anonymized) with expected extractions; run against the organize step and score field accuracy + boundary violations (any advisory language = hard fail). This eval is the regression suite for every future prompt change (applied-llms practice).

## Phase 3 — Timeline & retrieval (~2 days)

0. **"Design the last moment first" (DESIGN_REVIEW_LENS):** mock the visit brief BEFORE polishing the timeline — the timeline serves the brief, not vice versa. Generate Impeccable `DESIGN.md` from our tokens before the first agent-built UI.
1. **Timeline page** per profile: keyset-paginated union (documents ∪ appointments) by event date; skeleton loading; aspect-ratio-reserved thumbnails (zero CLS); Intersection Observer for load-more.
2. **Document detail:** image + what-it-says + term definitions + as-written medications/tests, each visibly cited ("as written in this document").
3. **Search:** FTS + trgm server action; combobox client per the design-doc contract (300ms debounce, query-keyed responses, session cache, ARIA combobox, recent-documents empty state, `/` shortcut).

## Phase 4 — Visit brief & appointments (~1–2 days)

1. **Visit brief:** read-time aggregation — profile header, medications-as-written (source-cited), latest document per type, recent/upcoming appointments; print-friendly; the one-tap hero surface.
2. **Appointments:** CRUD + upcoming surface on timeline top.
3. **Reminders:** Vercel Cron route → `getDueReminders` → Resend email to the family address; `reminder_sent_at` guard.

## Phase 5 — Onboarding, landing, polish (~1–2 days)

1. **First-capture onboarding:** post-register → straight to capture → AI-proposed profile confirmation (manual path preserved).
2. **Landing page** at `/`: hero moment, 3-step walkthrough, trust block ("explains, never diagnoses"; DPDP posture).
3. **Polish pass:** empty states, mobile viewport/touch-target audit, INP/CLS check with real data, `en-IN` formatting via Intl.

## Phase 6 — Dogfood (ongoing, no code by default)

Load the founder's family completely. Log every retrieval miss and organize error into CONTENT_LOG. After the first real doctor-visit use: review, then decide V1.5 (NL ask, pgvector, WhatsApp reminders) from evidence, not speculation.

---

## Consciously not in this plan
Second-account sharing, insurance/claims, discovery (V2), regional languages, push notifications, offline sync, virtualization — all parked in SYSTEM_DESIGN §O with their revisit triggers.
