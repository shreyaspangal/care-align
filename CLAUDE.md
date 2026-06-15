# Patient Coordinator — AI Build Assistant Context

This file is read at the start of every AI-assisted coding session. It gives enough context to work correctly without re-reading all the docs.

---

## Where new rules and docs belong — decide before you write

Before adding anything here or to `docs/`, pick the right location:

| What you're documenting | Right place | Wrong place |
|------------------------|-------------|-------------|
| A rule that causes a **silent, irreversible bug** if missed (auth grants, RLS, version counter) | **CLAUDE.md** | docs/ |
| A **security boundary** that must hold on every turn (no client-side AI calls, no raw Blob URLs) | **CLAUDE.md** | docs/ |
| A **scope constraint** that prevents entire feature categories from being built (V1 boundary) | **CLAUDE.md** | docs/ |
| A **breaking-change gotcha** for this stack (Next 16 async params, proxy.ts) | **CLAUDE.md** | docs/ |
| A **pattern with a worked example** that's only needed when doing that specific work (forms, migrations, AI prompts) | **docs/FORMS.md, docs/AI_BEHAVIOUR.md, etc.** — pointer in CLAUDE.md | CLAUDE.md inline |
| A **catalogue or reference** (component props, enum values, ER diagram) | **docs/** | CLAUDE.md |
| Something already **enforced by a lint script or hook** | Pointer only in CLAUDE.md | Full detail in CLAUDE.md |
| **Environment variables** | **.env.example** | CLAUDE.md |
| **Testing setup** | **docs/TESTING.md** | CLAUDE.md |

**The test:** If removing the rule from CLAUDE.md means the first line of code in a new session could silently be wrong or cause a production incident — keep it here. If it would only matter once the relevant file is open — a pointer is enough.

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
5. **`useActionState` signature is `(_prev, formData)`**, not `(formData)`. Returns `[state, action, isPending]`. Forgetting `_prev` shifts the args and `formData` becomes the previous state object — silent wrong behaviour, no type error.

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

## Supabase Migration Checklist — Run Every Time a Table is Created

Supabase requires **two separate access control layers**. RLS policies alone are not enough — table-level GRANTs must also be present or authenticated users and triggers will be silently denied.

Every migration that creates a new table **must** include:

```sql
-- Required alongside RLS — without this, authenticated users cannot access the table at all
GRANT SELECT, INSERT, UPDATE, DELETE ON table_name TO authenticated;
GRANT ALL ON table_name TO service_role;
```

For any trigger that writes to `public.*` tables (like `handle_new_user`):

```sql
-- supabase_auth_admin is the role that runs auth triggers — it needs explicit INSERT
GRANT INSERT ON public.profiles TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
```

**Root cause of "Database error saving new user":** Missing `GRANT INSERT ON public.profiles TO supabase_auth_admin`. The trigger ran but had no table-level permission to insert, aborting the entire `auth.users` creation.

**Chicken-and-egg pattern — patient creation:** RLS on `patients` requires a `patient_access` row to exist, but that row can't exist until the patient is created. Solution: use `createServiceClient()` (service role, bypasses RLS) for the initial `patients` insert, then immediately insert the `patient_access` row. All subsequent queries use the regular `createClient()` and RLS works correctly from that point. See `actions/create-patient.ts`.

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

11. **Client components never import server actions directly.** Server actions are injected as props by the parent RSC page or layout. Stories pass `fn()` from `storybook/test`. Direct imports pull `next/cache`, `next/headers`, and other Node-only modules into Vite's ESM bundler, crashing Storybook and the test runner. Pattern and worked example: `docs/COMPONENT_PLAN.md` — Server Action Injection Pattern.

13. **All DB-aligned union types live in `lib/types/domain.ts` only.** Never redefine `DocumentType`, `EpisodeStatus`, `TaskCategory`, `TranslationStatus`, `DocumentStatus`, `ActionFor`, `TaskPhase`, `TaskStatus`, `UserRole`, or `AdmissionStatus` inline in any component, action, or other lib file. Import them. `pnpm lint:types` enforces this — a violation causes silent type drift when a DB enum changes.

14. **AI SDK structured output uses `generateText + Output.object({ schema })`.** `generateObject` and `streamObject` are `@deprecated` in `ai@6+`. The result is `result.output` (typed). The error to catch is `NoOutputGeneratedError`, not `NoObjectGeneratedError`. File input uses `mediaType` (not `mimeType`) on the `FilePart`. See `lib/ai/classify.ts` for the canonical pattern. `pnpm lint:types` enforces this — using deprecated APIs fails CI.

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
| AI output — actions | `action_for`, `category`, `phase_appears`, `action_status` | `document_actions` |
| Task list | `action_for`, `task_category`, `task_phase`, `task_status` | `pending_tasks` |

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
→ Claude: translate → create DocumentTranslation + DocumentActions + PendingTasks (status: translated)
→ Claude: regenerate EpisodeSummary (non-fatal — failure keeps previous version)
```

If any step throws: set `document.status = 'failed'`, return error to UI, do not delete the record.

---

## Architecture Enforcement — Machine-Backed Rules

Run `pnpm lint:arch` before committing. The pre-commit git hook (`.githooks/pre-commit`) runs the same checks automatically — it is activated via `git config core.hooksPath .githooks` (runs automatically on `pnpm install` via the `prepare` script).

`pnpm lint:arch` runs three checks in sequence:

| Step | What it catches |
|------|-----------------|
| `tsc --noEmit` | All TypeScript type errors including unused variables and parameters |
| `eslint` (AST-based) | Raw HTML primitives in composites/features; inline domain type redefs; deprecated AI SDK APIs; `console.*` in server files; server actions missing `.safeParse()`; unused imports/vars; floating promises; exhaustive hook deps |
| `node scripts/check-stories.mjs` | Missing or stale `.stories.tsx` alongside any component (filesystem check — ESLint cannot do this) |

**Retired scripts** (`check-primitives.mjs`, `check-schemas.mjs`, `check-types.mjs`) — deleted. Their checks now live in `eslint.config.mjs` as AST-accurate custom rules under the `carealig/` plugin namespace. The regex-based scripts had a multiline JSX gap that silently passed violations; ESLint does not.

**Custom ESLint rules** (in `eslint.config.mjs`, `carealig` plugin):
- `carealig/no-raw-html-primitives` — replaces `check-primitives.mjs`
- `carealig/no-inline-domain-types` — replaces the type-redef check in `check-types.mjs`
- `carealig/no-deprecated-ai-sdk` — replaces the AI SDK check in `check-types.mjs`
- `carealig/no-console-in-server-files` — replaces the logging check in `check-schemas.mjs`
- `carealig/server-action-requires-safeParse` — replaces the server-action check in `check-schemas.mjs`
- `carealig/no-raw-color-values` — no raw `oklch()`/`#hex`/`rgb()` in `className` or `style` props; all colors must use design token Tailwind classes or `var(--token)`

**Design token naming convention** (`globals.css` → `@theme inline` → Tailwind utilities):

Every semantic color namespace follows the same suffix pattern so themes can be swapped by redefining variables:

| Suffix | Role | Example class |
|--------|------|---------------|
| `-base` | Solid fill — buttons, icons, strong text | `bg-brand-base` |
| `-on` | Text/icon on top of a `-base` fill | `text-brand-on` |
| `-tint` | Very light background wash | `bg-brand-tint` |
| `-border` | Borders and dividers in this context | `border-brand-border` |
| `-surface` | Page-level background tint (larger areas) | `bg-patient-surface` |

Current namespaces: `brand` (coordinator), `patient`, `ai`, `success`. Adding a new role (e.g. doctor): define `--doctor-base/on/tint/border/surface` in `:root` and register in `@theme inline`. For a new theme, redefine all `--brand-*` vars under `[data-theme="x"]`.

**Never use arbitrary color values** (`text-[oklch(...)]`, `bg-[#fff]`, `style={{ color: '#...' }}`). The lint rule blocks this at CI. For a confirmed one-off exception: add `// eslint-disable-next-line carealig/no-raw-color-values` with a brief justification.

A PostToolUse hook in `.claude/settings.json` also fires `pnpm lint:arch` inline when you write a component or action file.

### Phase exit gate — run before starting the next phase

Every phase must be closed in this order before any new phase work begins:

1. `pnpm tsc --noEmit` — zero type errors
2. `pnpm lint:arch` — all 4 checks green
3. `pnpm test` — all tests pass
4. Update `docs/CONTENT_LOG.md` — answer the three questions for the phase
5. Commit with a phase-named message (e.g. `feat: Phase 7 — coordinator dashboard display`)
6. `git status` clean — nothing uncommitted before proceeding

**Why this order matters:** Phases overlap in files. If Phase 8 starts before Phase 7 is committed, the two phases become entangled in the diff and cannot be separated cleanly. Each phase is one commit. Each commit is one phase.

---

### Stop conditions

- **New component, no story pattern yet** — stop, propose interface + story states, wait for sign-off.
- **Primitive missing from Shadcn** — stop, propose it in `docs/COMPONENT_PLAN.md`, wait for sign-off.
- **Schema missing for a new action/form** — stop, define it in `lib/validation/schemas.ts` first.

### Key pointers

- Form handling contract (7 rules, worked example): `docs/FORMS.md`
- Component primitives catalogue: `docs/COMPONENT_PLAN.md`
- Logging pattern (`createLogger`): `lib/logger.ts`
- All schemas (single source of truth): `lib/validation/schemas.ts`

---

## Testing and Environment

Testing detail: `docs/TESTING.md`. Environment variables: `.env.example`.
