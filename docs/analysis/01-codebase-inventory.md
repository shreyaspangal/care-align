# Phase 1 — Codebase Inventory

**Date:** 2026-07-13
**Method:** Every file in `/docs` read in full first (per session rules), then the full source tree read: `package.json`, all 11 migrations, all 14 server actions, all `lib/` modules, the route tree, `proxy.ts`, ESLint config, test suite, and git history. This document records **what exists** — no quality evaluation, no recommendations. Contradictions between docs and code are flagged in §7 per session rule 6. Observations relevant to the wedge search are collected in §8 as raw material for Phase 5 — not conclusions.

---

## 1. Repository structure (meaningful parts)

```
Kaagaz/  (product name: CareAlign; package.json name: "CareAlign")
├── AGENTS.md                  ← agent orientation (build status, silent-failure rules)
├── CLAUDE.md                  ← 14 hard rules governing all code changes
├── README.md                  ← 65 lines, standard project readme
├── proxy.ts                   ← Next 16 middleware replacement: session refresh + home-path routing
├── app/
│   ├── page.tsx               ← redirect('/login') — no landing page
│   ├── layout.tsx, globals.css, favicon.ico
│   ├── (auth)/                ← login + register (RSC wrapper + client form pairs)
│   ├── (public)/join/[token]/ ← patient invite redemption (PIN entry, auto-join, error states)
│   ├── (app)/                 ← THE single unified route tree (post-ADR-013)
│   │   ├── layout.tsx         ← one shell for any authenticated user; sidebar fed by getMyAccessList
│   │   └── dashboard/
│   │       ├── page.tsx + DashboardContent.tsx  ← "Your people" list / "Add your first patient" form
│   │       ├── new/page.tsx   ← add-patient form
│   │       └── [patientId]/
│   │           ├── layout.tsx ← the per-record auth gate; branches header/tabs/actions on patient_access.role
│   │           ├── page.tsx   ← Documents tab (upload zone + timeline)
│   │           ├── summary/   ← Summary tab (episode summary panel; patient variant)
│   │           ├── tasks/     ← Tasks tab (pending tasks, resolve flow)
│   │           └── access/    ← patient-only "who has access" list + revoke
│   └── api/documents/[documentId]/file/route.ts  ← authenticated Blob serving (RLS + signed URL redirect)
├── actions/                   ← 14 server actions (see §4)
├── components/
│   ├── primitives/            ← 4: DocumentTypeTag, EpisodeStatusBadge, TaskCategoryIcon, TranslationStatusIndicator
│   ├── composites/            ← 3: DocumentCard, EpisodeStatusCard, PendingTaskRow
│   ├── features/              ← 16 feature components (see §4)
│   ├── ui/                    ← 15 Shadcn primitives + logo
│   └── theme-provider.tsx
│   (every primitive/composite/feature has a colocated .stories.tsx — enforced by scripts/check-stories.mjs)
├── lib/
│   ├── ai/                    ← models.ts, schemas.ts, classify.ts, translate.ts, summarise.ts
│   ├── auth/resolve-home-path.ts
│   ├── dal/                   ← documents, episodes, invites, patients, profiles, tasks (cache()-wrapped, server-only)
│   ├── db/episode-summaries.ts  ← version-safe RPC wrapper (sole survivor of the old lib/db plan)
│   ├── storage/               ← blob.ts (pathname pattern), validate.ts (MIME + size)
│   ├── supabase/              ← server.ts, client.ts, service.ts (3 clients)
│   ├── types/domain.ts        ← single source of truth for DB-aligned unions (Hard Rule 13)
│   ├── validation/schemas.ts  ← all Zod form/action schemas
│   ├── logger.ts, ratelimit.ts, utils.ts
├── supabase/migrations/       ← 11 migrations (see §3)
├── scripts/                   ← check-stories.mjs (lint gate), seed-dev.ts (dev seed)
├── __tests__/                 ← unit + RLS integration tests only (see §5)
├── eslint.config.mjs          ← 489 lines; 8 custom carealig/ AST rules
├── .githooks/pre-commit       ← runs pnpm lint:arch
├── .storybook/                ← Storybook 10 (nextjs-vite) config
├── .design-sync/              ← claude.ai/design integration (untracked cache + notes)
├── ds-bundle/                 ← gitignored design-sync build artifacts (compiled components, screenshots)
├── public/design-preview.html ← tracked static design preview
└── docs/                      ← the 14 planning/reference docs read in Phase 1
```

Empty placeholder dirs: `hooks/` (only `.gitkeep` — no custom hooks exist).

---

## 2. Tech stack — verified from package.json and imports

| Layer | Actual dependency | Notes |
|---|---|---|
| Framework | `next@16.2.6`, `react@19.2.4` | App Router only; `proxy.ts` not `middleware.ts` |
| Language | TypeScript 5, `zod@4.4.3` | |
| DB/Auth | `@supabase/supabase-js@2.108`, `@supabase/ssr@0.12` | RLS + GRANT dual-layer model |
| Files | `@vercel/blob@2.4` | private store, pathname-only persistence |
| AI | `ai@6.0.198`, `@ai-sdk/anthropic@3.0.81`, **`@ai-sdk/openai@3.0.71`** | OpenAI SDK is present solely to reach **OpenRouter** (dev tier) — see §7.1 |
| Rate limiting | `@upstash/ratelimit@2`, `@upstash/redis@1.38` | 10 uploads/hr/user (`lib/ratelimit.ts`) |
| UI | shadcn (radix-nova via `radix-ui@1.5`), Tailwind v4, `lucide-react`, `cmdk`, `sonner`, `next-themes` | |
| Auth for invites | `bcryptjs@3` | PIN hashing |
| Testing | Vitest 4 (+ Storybook addon-vitest browser mode), Testing Library, MSW 2, Playwright 1.60 | Playwright installed but **no e2e specs or config exist** — §5 |
| Tooling | ESLint 9 flat config, Prettier, Storybook 10, `supabase` CLI (dev dep), `vercel@54` (dev dep) | |

No `src/` dir; `@/*` maps to repo root. No `.github/` — **no CI pipeline exists** despite TESTING.md describing one.

---

## 3. Database schema as it actually exists (from the 11 migrations)

### Migration history

| Migration | What it did |
|---|---|
| `20240101000000_initial_schema` (471 lines) | 11 enums, 8 tables, `handle_new_user` trigger, `user_has_patient_access()` helper, all indexes, RLS policies, `upsert_episode_summary` RPC |
| `20240102000000_fix_grants` | blanket `GRANT ... ON ALL TABLES TO authenticated/service_role` (the missing GRANT layer) |
| `20240103000000_fix_trigger_grants` | grants for `supabase_auth_admin` so signup trigger can insert profiles |
| `20240104000000_fix_handle_new_user` | trigger fix |
| `20240105000000_action_classification_columns` | added `category`+`phase_appears` to `document_actions`, `action_for`+`source_action_id` to `pending_tasks` (self-describing tables) |
| `20260616000000_patient_invites` | invite table (token, expiry, used_at) |
| `20260616000001_fix_patient_access_rls` | removed `OR user_id = auth.uid()` self-grant hole from INSERT policy |
| `20260616000002_patient_invites_pin` | `pin_hash`, `pin_attempts`, `pin_locked_at` |
| `20260616000003_patient_document_read_access` | patient SELECT policy on `documents` |
| `20260616000004_patient_access_pinned` | `pinned_at` on `patient_access` |
| `20260702000000_patient_access_provenance_and_revocation` | `provenance` enum + column, `invite_id`, 3 DELETE policies (bilateral revocation), 2 new SELECT policies (patient sees coordinators; profiles visible to co-access users) |

### Tables (9): `profiles`, `patient_access`, `patient_invites`, `patients`, `episodes`, `documents`, `document_translations`, `document_actions`, `episode_summaries`, `pending_tasks`

The live schema matches `docs/DATA_MODEL.md` (which was synced on 2026-07-13) with the entity/RLS shapes described there. Key structural facts verified directly in SQL:

- `patients` has **no user/profile foreign key** — the patient record is linked to people only through `patient_access`. `patients.name` holds the patient's name.
- `patient_access` is the entire permission model: `(user_id, patient_id, role, provenance, pinned_at, invite_id)`, unique on `(user_id, patient_id)`.
- Bilateral revocation DELETE policies exist exactly as DATA_MODEL.md describes.
- `episode_summaries.version` increments only via the `upsert_episode_summary` RPC.
- Soft-delete `deleted_at` columns exist on all clinical entities.
- One enum drift exists between DB and TypeScript — flagged in §7.2.

---

## 4. Feature inventory — implemented / stubbed / broken

### Fully implemented (verified end-to-end in code)

| Feature | Where |
|---|---|
| Auth: register (coordinator-only path), login, logout | `app/(auth)/`, `actions/auth.ts`, `proxy.ts` |
| Session refresh + home-path routing (`resolveHomePath`: 1 access row → straight to record; 0 or many → `/dashboard`) | `proxy.ts`, `lib/auth/resolve-home-path.ts` |
| Unified shell: sidebar with full access list (any role), pin/unpin, archive filter, search on dashboard | `app/(app)/layout.tsx`, `CoordinatorSidebarNav`, `DashboardContent` |
| Create patient (any authenticated user becomes that record's coordinator; service-client bootstrap + `coordinator_attested` provenance) | `actions/create-patient.ts` |
| Create episode | `actions/create-episode.ts` |
| Document upload pipeline: hints → validate → rate-limit → insert record → Blob → classify → translate → actions+tasks insert → episode summary regen (non-fatal) → status transitions per ADR-009 | `actions/upload-document.ts` (268 lines), `lib/ai/*`, `lib/storage/*` |
| Classification editing post-AI | `DocumentClassificationEditor`, `actions/update-document-classification.ts` |
| Document delete (confirm dialog, soft delete) | `actions/delete-document.ts`, `DocumentCard` |
| Authenticated file serving (RLS-scoped select → 302 to signed Blob URL; 404 non-oracle) | `app/api/documents/[documentId]/file/route.ts` |
| Episode summary display + version counter | `EpisodeSummaryPanel`, `PatientSummaryPanel`, `lib/db/episode-summaries.ts` |
| Pending tasks: list/card views, phase filtering, optimistic resolve with rollback, resolution notes | `TasksClient`, `actions/resolve-task.ts` |
| Episode status transitions (active → care_complete → closed) with inline confirm | `actions/update-episode-status.ts` |
| Patient invite flow: one-time token + optional bcrypt PIN, 5-attempt permanent lock, WhatsApp-able link, regenerate-expires-old, redemption creates `self_consented` access | `actions/create-invite.ts`, `actions/join-as-patient.ts` (297 lines), `app/(public)/join/[token]/` |
| Revocation, all three directions: coordinator revokes patient access; patient revokes any coordinator (Access tab); coordinator self-revokes ("leave") | `actions/revoke-*`, `actions/self-revoke-coordinator-access.ts`, `access/page.tsx` |
| Per-record role gate in `[patientId]/layout.tsx` (patient variant: no sidebar-header actions, summary-first tabs; coordinator variant: invite/revoke/leave buttons) | verified in layout source |
| Loading skeletons on all async routes; role-aware empty states | `loading.tsx` files, per CONTENT_LOG Phase 13 |
| Enforcement stack: 8 custom ESLint AST rules + `check-stories.mjs` + pre-commit hook | `eslint.config.mjs`, `.githooks/` |

### Implemented but functionally inert ("no-op by design today")

- **Coordinator self-revoke ("Leave")** — `actions/self-revoke-coordinator-access.ts` refuses when `coordinatorCount <= 1`. The code itself comments: *"There is currently no action to add a second coordinator to an existing record, so this guard will trigger for nearly every patient today."* There is **no invite-a-second-coordinator flow anywhere in the codebase**, so every existing patient has exactly one coordinator and the button always errors.
- **`getPatientCoordinators` for coordinators** — returns `[]` for a coordinator caller (RLS only lets patients see coordinator rows); a coordinator-facing "care team" view is explicitly deferred.
- **Language preferences UI** — `UserProfileMenu` lists 6 Indian languages, 5 disabled with "Soon" labels. `preferred_language` is stored but read by nothing.
- **`profiles.role`** — still written at signup, read by no auth gate (display/history only, per ADR-013).
- **`pending_tasks.source_action_id`** — column exists for lineage but `upload-document.ts` inserts tasks **without** setting it (actions and tasks are inserted as parallel lists, not linked).

### Stubbed / absent despite being described in docs

- **No landing page.** `app/page.tsx` redirects to `/login`; `proxy.ts` also redirects. The 2026-06-15 design session (CONTENT_LOG) decided a full 6-section orientation landing page with taglines and 3D clay icons — none of it exists.
- **No onboarding of any kind.** Confirmed the ONBOARDING_RESEARCH finding still holds: zero files matching onboarding/welcome/tour/checklist. `/join/[token]` still shows only PIN form or error states with no explanation of what CareAlign is.
- **No AI input limits.** `lib/ai/limits.ts` (maxPdfPages 20, token estimate) appears in ARCHITECTURE.md's tree and AI_BEHAVIOUR.md — the file does not exist and nothing enforces a page limit before the AI call. Only the 10 MB size cap in `validate.ts` is real.
- **No E2E tests, no AI fixture/boundary tests, no adversarial tests, no CI.** See §5.
- **Upload idempotency / duplicate detection** (ADR-010 §3) — not implemented; re-uploading the same file creates a new document record.
- **Retry for failed documents** — `status: 'failed'` is set and the UI labels it, but no retry action re-runs the pipeline on an existing record (ADR-009 describes retry re-running steps 3–5).

### Broken / anomalous (observed in code, mechanism traced)

1. **Patient name never reaches the AI prompts.** `actions/upload-document.ts:147` fetches `patients(profiles(name))` to personalise translation. `patients` has no FK to `profiles`; the patient's name lives on `patients.name` itself. PostgREST can only resolve `profiles` through the `patient_access` junction — which yields the *account holders'* profiles (coordinator/patient users), as an array, not the patient record's name. The code then reads `?.profiles?.name` (object access on an array) → `undefined` → falls back to `'the patient'`. Consequences: (a) every translation/summary prompt loses personalisation the prompts were designed around; (b) if the embed makes the query error, `episode` is null and `patientId` is undefined, so both `revalidatePath` calls are skipped and the UI shows stale data after upload. (This matches the pre-existing gap-analysis note from 2026-07; re-verified against source today.)
2. **`preferred_language` type drift** — see §7.2. Hard Rule 13's protected list doesn't include `PreferredLanguage`, so the ESLint rule doesn't catch it.

---

## 5. Test suite — what actually runs

```
__tests__/
├── unit/            primitives.test.tsx, composites.test.tsx, validate.test.ts,
│                    harness.test.ts, lib/auth/resolve-home-path.test.ts
├── integration/rls/ coordinator-access.test.ts, patient-access.test.ts   (real test Supabase project)
├── mocks/           MSW server + Claude handlers
├── fixtures/        seed-ids.ts
```

Plus Storybook story-based interaction tests via `@storybook/addon-vitest` (every component has stories; stories run as browser-mode Vitest tests).

**Absent relative to TESTING.md:** `__tests__/e2e/` (Playwright specs), `__tests__/ai/` (real-Claude fixture + boundary tests), `__tests__/integration/actions/` (upload-document integration), adversarial response-handling tests, document fixtures, `.github/workflows/test.yml`. `package.json` still defines `test:e2e` and `test:ai` scripts pointing at these non-existent paths; there is no `playwright.config.*`.

---

## 6. Dead code, unused artifacts, abandoned approaches

- **`ds-bundle/`** (gitignored, on disk): compiled design-sync bundle including `PatientViewTabNav` — a component that no longer exists in `components/` (merged into `PatientTabNav` during ADR-013). The bundle is stale relative to the route unification.
- **`debug-storybook.log`** (repo root, ignored via `*storybook.log`): leftover Storybook installer log.
- **`docs/AI_HACKATHON_HEALTHCARE.md`** is deliberately **gitignored** yet lives in `docs/` on disk — an intentionally untracked parallel research track (India AI Hackathon, June 2026), not dead code but easy to mistake for tracked documentation.
- **`public/design-preview.html`** — tracked static preview page from the design-sync workflow; not referenced by the app.
- **`hooks/`** — empty placeholder directory.
- **Abandoned approaches recorded in git/docs (already rolled back, no residue):** two-route-tree architecture (`app/(coordinator)`/`app/(patient)` — superseded by ADR-013), regex lint scripts (replaced by ESLint AST rules), `use-places-autocomplete` library (replaced by direct Places API (New) calls), frictionless no-PIN invite (replaced by PIN flow), amber patient theming (replaced by single brand teal).
- **Google Maps hospital autocomplete** — implemented but conditional on `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; falls back to plain text input when unset.

---

## 7. Contradictions between docs and code (flagged per session rule 6)

1. **AI model map.** CLAUDE.md Hard Rule 3 and AI_BEHAVIOUR.md say development = Claude Haiku, production = Claude Sonnet (`claude-sonnet-4-6`). `lib/ai/models.ts` actually uses: development = **`google/gemma-4-31b-it:free` via OpenRouter** (no tool-calling → `Output.object` silently degrades to prompt-based extraction, documented in CONTENT_LOG Phase 12), production = **`claude-haiku-4-5`** — Sonnet is used nowhere. `.env.example` says "production = Anthropic Sonnet" while the code pins Haiku. Docs describe a model tier that doesn't exist in code.
2. **`PreferredLanguage` drift.** DB enum: `('en','hi','kn','ta','te','ml','other')`. `lib/types/domain.ts`: `'en'|'hi'|'kn'|'ta'|'te'|'mr'` — `ml` (Malayalam) became `mr` (Marathi) and `'other'` is missing. This is exactly the silent drift Hard Rule 13 exists to prevent; the rule's governed-type list doesn't cover this type.
3. **Task category/phase provenance.** DATA_MODEL.md states `document_actions.category` and `phase_appears` are "derived from document.type at write time — not from Claude output. See `lib/ai/classify-action.ts`." That file does not exist; in code, Claude returns `category` and `phase_appears` directly in the translation `ActionSchema` (`lib/ai/schemas.ts:36-41`) and they are written verbatim. AI_BEHAVIOUR.md's printed `ActionSchema` (only `action_for` + `description`) is likewise stale.
4. **AI limits.** AI_BEHAVIOUR.md and ARCHITECTURE.md describe `lib/ai/limits.ts` (20-page PDF cap, token estimate) as enforced "before calling Claude." It is not implemented.
5. **Testing plan vs reality.** TESTING.md describes E2E specs, AI fixture/boundary tests, adversarial tests, an upload-document integration test, and a three-job GitHub Actions pipeline. None exist. Its exit-criteria checklist for V1 is mostly unmet, while AGENTS.md declares V1 "feature-complete."
6. **Landing page.** CONTENT_LOG (2026-06-15) records a decided landing-page IA ("Landing page at `/` — not a redirect to login", 6 sections, three taglines). `app/page.tsx` still redirects to `/login`. The decision log and the code disagree about whether this was to be built before or after inner-page polish — build order in that entry says landing page is "last in the build queue," so this may be sequencing rather than contradiction, but the decided artifact does not exist.
7. **ARCHITECTURE.md project tree** still shows the pre-ADR-013 layout (`app/(coordinator)/`, `app/(patient)/`) and `lib/db/{episodes,documents,translations,tasks}.ts` — the tree section was not updated when ADR-013 was appended (the ADR text itself is current). Actual data access lives in `lib/dal/`; `lib/db/` contains only `episode-summaries.ts`.
8. **ADR-010 partial implementation.** Server-side validation ✓ and rate limiting ✓ exist; the third mechanism (upload idempotency) does not.
9. **SPEC.md still describes "Two Users … separate accounts for coordinator and patient roles"** (also ROADMAP V1 bullet "Supabase Auth — separate accounts for coordinator and patient roles"). ADR-013 made role a per-record permission — SPEC.md and ROADMAP.md were never updated to reflect the unified access model.

---

## 8. Raw observations for the wedge search (Phase 5 input — recorded, not concluded)

Per the session north star, moments in the codebase/docs where a narrow, specific capability already exists (or is conspicuously absent) that the broad players don't serve:

- **The invite mechanism is built for an Indian, low-digital-literacy, hospital-stress context** — WhatsApp link + PIN read out over a voice call, "access code" naming (not "OTP"), no email/password for the patient, works down to a ₹500 feature phone receiving a call. This exact flow (documented reasoning in CONTENT_LOG Phase 10) is a distribution-relevant asset no researched competitor has.
- **Provenance (`self_consented` vs `coordinator_attested`) + bilateral revocation is a consent architecture that Indian law has no pathway for and no competitor implements** (per PRIVACY_TRUST_RESEARCH: DPDP has no adult-to-adult delegation; CareZone's collapse of the two cases is the documented anti-pattern). The schema already distinguishes what the law cannot.
- **The episode as the atomic unit** (time-bounded hospitalisation, two end dates — medical vs administrative closure) is a data-model choice no competitor in SPEC.md/ONBOARDING_RESEARCH's tables has; every PHR competitor models a longitudinal record or a document pile, not "this hospitalisation as a story."
- **"Silence is valid"** (`actions: []`, no manufactured urgency) is a stated product principle enforced in schema and prompt — a trust posture opposite to engagement-driven health apps.
- **The one-coordinator-per-record reality** (self-revoke a no-op; no second-coordinator invite) means the product currently structurally assumes a *single* burdened family member — the exact person SPEC.md's origin story describes. The multi-sibling / NRI-family case is schema-ready but UI-absent.
- **The distance-coordinator framing** in SPEC.md's "moment that matters" (away from hospital, is anything missed?) remains unserved: no notifications, no daily digest, nothing push-based exists in the codebase — the product today only answers when opened.
- **The parallel hackathon doc** shows the same engine re-aimable at CHW/ASHA rural intake — evidence the underlying pipeline (classify → translate → tasks → summary) is a multi-wedge asset, with the wedge choice genuinely open.

---

## 9. Scale of the codebase (for calibration)

~14 server actions (~1,340 lines), ~6 DAL modules (~400 lines), 5 AI modules (~320 lines), 23 components + 23 story files, 11 migrations (~810 lines SQL), 8 custom lint rules (489-line ESLint config), 7 test files. Total app code is small and coherent — the docs corpus (≈6,900 lines) is roughly the same order of magnitude as the source it describes.
