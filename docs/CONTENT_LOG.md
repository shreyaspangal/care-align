# CareAlign — Content Log

> Daily capture of the building journey. Raw notes only — no editing, no formatting. The editing happens later. The only rule: capture it the same day it happened.

---

## The Three Questions

At the end of every build session, answer these three:

1. **What did I decide today?** — Not what you built. What decision you made and what you were choosing between.
2. **What resisted me today?** — The moment where something was harder than expected. The friction. The doubt. The temptation to pivot.
3. **What did I understand today that I didn't yesterday?** — The insight that shifted something.

---

## Pre-Build — Spec and Architecture

**Date:** Before first commit

**What did I decide?**
Spent the first session writing docs instead of code. Wrote the full data model, architecture decisions, build plan, and component plan before touching any implementation. The decision was: spec first, build second. The alternative was to start building and figure it out as I go — which is what most people do.

**What resisted me?**
The temptation to just start. Every instinct said "open the editor, write some code, figure out the schema later." Writing a 500-line data model document when nothing works yet feels like procrastination. It isn't — but it feels like it.

**What did I understand?**
The difference between a spec and a plan. A plan tells you what to build. A spec tells you what the thing *is* — what it does, what it doesn't do, who uses it and why. The spec is what lets an AI agent work without constantly asking you what you meant. Writing it is not overhead. It is the work.

---

## Phase 1 — Foundation + Test Harness

**Commit:** `5d8c307`

**What did I decide?**
Set up MSW (Mock Service Worker) for tests before writing a single component. The decision was between mocking Claude API calls in tests vs. hitting the real API. Chose MSW — it intercepts at the network layer, which means the test code is identical to production code. The mock lives in one place, not scattered across test files.

**What resisted me?**
Understanding why `onUnhandledRequest: 'error'` matters. The default is to silently let unhandled requests through — which means a test can pass while making real network calls you don't know about. Setting it to error forces every network call to be explicitly declared. It felt like extra strictness for no reason until you understand what it prevents.

**What did I understand?**
A test harness is not just about running tests. It is about making the failure modes explicit. Silent network leaks in tests are the same as silent failures in production — you don't know something is wrong until it causes a problem somewhere else.

---

## Phase 2 — Database Schema + RLS

**Commit:** `0daba7d`

**What did I decide?**
Three concepts that look identical on the surface but are fundamentally different: Authentication (`auth.users`), Profile (`profiles`), and Access Grant (`patient_access`). The decision was to keep them as three separate tables rather than collapsing them. The temptation was to put role directly on the user and be done with it.

Chose Supabase + Postgres over Firebase, PlanetScale, and DynamoDB. The deciding factor: Row Level Security enforced at the database layer, not the application layer. Medical data that relies solely on application-level access control is one missed `if` statement away from a breach.

**What resisted me?**
The migration failed on first push with `ERROR: relation 'patient_access' does not exist (SQLSTATE 42P01)`. The helper function `user_has_patient_access()` was defined before the `patient_access` table existed. Postgres compiles function bodies at definition time — the table didn't exist yet. Fixed by reordering: enums → tables → trigger → helper fn → RLS → RPC. The order is not arbitrary. It is load-bearing.

**What did I understand?**
RLS is not a feature. It is a constraint on yourself. When RLS is on, even you — the developer — cannot accidentally read data you shouldn't. The database enforces the access model, not your application code. That matters when the data is someone's medical records.

**One thing that surprised me:**
The `upsert_episode_summary` RPC exists entirely to protect a version counter. A plain `.upsert()` in the Supabase JS client would reset `version` to whatever value you pass in. The RPC does `version = episode_summaries.version + 1` atomically. One SQL function prevents an entire class of race condition bugs.

---

## Phase 3 — Auth, Proxy Routing, Supabase Clients

**Commit:** `187a718` + fix `649aab4`

**What did I decide?**
Two Supabase clients, not one. A server client (`lib/supabase/server.ts`) that is async and reads/writes cookies — used in Server Components and Server Actions. A browser client (`lib/supabase/client.ts`) that is synchronous — used in Client Components only. The split is not stylistic. The server client uses the publishable key and cookie storage. The browser client also uses the publishable key — safe because RLS enforces access at the database layer regardless of which key is used.

Used `getUser()` in proxy.ts, never `getSession()`. `getSession()` trusts the cookie blindly — it does not validate the JWT against Supabase's servers. If someone crafts a fake cookie, `getSession()` accepts it. `getUser()` makes a network call to verify. For routing decisions that gate access to medical data, trust must be verified, not assumed.

**What resisted me?**
Next.js 16 breaking changes. `cookies()` is async-only — the sync version was removed. `middleware.ts` is renamed to `proxy.ts` with a `proxy` named export. Dynamic route params are Promises and must be awaited. None of these are in the model's training data for Next.js 15. Every assumption had to be checked.

**What did I understand?**
Session refresh has to happen in the proxy, not the component. When Supabase refreshes an auth token, it writes new cookies. In a Server Component, cookies are read-only — the write silently fails. The proxy runs before every request and has write access to both request and response cookies. That is the only place where token refresh works correctly.

---

## Phase 4 — UI Primitives, Composites, Auth Pages, Storybook

**Commit:** `b8cfb3a`

**What did I decide?**
Built primitives before composites before features. Never the other way. Each primitive covers exactly one concept: document type, episode status, task category, translation status. Each composite assembles from primitives only — no new atoms invented inside a composite. This constraint felt artificial until a bug appeared: `<button>` cannot contain `<button>` in HTML. `DocumentCard` was a button. `TranslationStatusIndicator` in failed state is also a button. The constraint forced the fix: `DocumentCard` becomes a `div` with `role="button"` instead.

Added Storybook with the goal of evolving these components into a public healthcare UI library — same model as MagicUI/Aceternity but domain-specific. Stories are colocated with components, not in a separate `stories/` folder. Each story covers every prop value, not just the happy path.

**What resisted me?**
Storybook's CSS check. Tailwind v4 uses `oklch` colour space internally, not `rgb`. The CssCheck story asserted `rgb(239, 246, 255)` for `bg-blue-50` — which is correct in Tailwind v3. In v4 the computed value is `oklch(0.97 0.014 254.604)`. The test failed, which is exactly what it is supposed to do: prove that CSS actually loaded and that the values match what the browser computes, not what you assume.

Auth errors originally returned `{ error: string }` from Server Actions. TypeScript rejected this — form `action` props must return `void`. Fixed by redirecting to `?error=` query params instead. The page reads `searchParams` and renders the error inline.

**What did I understand?**
Storybook is not a testing tool. It is a contract. When you write a story for every prop value, you are writing down what the component is supposed to do in a form that is both human-readable and machine-verifiable. An agent reading the story file knows exactly what the component accepts, what it renders, and what it should not do. That is more precise than a comment and more durable than a doc.

**One thing that surprised me:**
The `CssCheck` story caught a real incompatibility between Tailwind v3 assumptions and Tailwind v4 reality on the first run. A test that proves CSS loaded is not paranoid. It is the only way to know Storybook is rendering with the actual styles and not unstyled HTML that happens to pass `toBeVisible()`.

---

## Phase 5 — Vercel Blob File Upload (in progress)

**What did I decide?**
Validation runs twice: once client-side in `DocumentUploadZone` for instant feedback, and once server-side in the Server Action before anything touches the database or Blob. The client check is UX. The server check is security. Never trust client-side validation alone.

The `file_key` column stores the Blob pathname, not the full URL. Full URLs change when a Blob store migrates or is recreated. Pathnames are stable. Signed URLs are generated fresh on every file access request via `/api/documents/[documentId]/file`.

Chose to keep the Document record even when upload fails — `status: failed`, never deleted. This gives the coordinator a visible failure state to retry from, and preserves the audit trail of what was attempted.

Blob store created as **private** in Vercel's Mumbai (BOM1) region. Private means no URL gives access without a valid signed token. Mumbai because the patients and coordinators are in India — latency matters when a coordinator is uploading a document on a hospital Wi-Fi connection.

**What resisted me?**
Getting `BLOB_READ_WRITE_TOKEN` out of Vercel. Sensitive env vars cannot be retrieved once set — not via the CLI, not via the dashboard edit field. The only path is to create a new token and update the env var. Vercel's security model is intentional: a token you can retrieve is a token that can be stolen from your CI logs or your terminal history.

**What did I understand?**
Rate limiting is not about preventing abuse. It is about preventing accidents. A coordinator who accidentally triggers an upload loop — or a bug that does it for them — should not generate $200 in Claude API costs before anyone notices. 10 uploads per hour per user is generous for legitimate use and a hard stop for anything that goes wrong.

---

## Phase 5 + Enforcement — Zod schemas, form contract, lint gates, hooks

**What did I decide?**

Rules need a feedback loop, not just a location. A rule in a doc gets read once. A lint script you have to remember to run fails silently when forgotten. So we put each rule in three places: a lint script (CI + manual), a `PostToolUse` hook (fires the moment you write the file), and `CLAUDE.md` (session start). Same rule, three feedback loops — each catching the failure the others miss. That's progressive disclosure of constraints: the right rule at the right moment, not everything upfront.

`CLAUDE.md` was 330 lines. Most of it was pattern detail — form contract code examples, enum tables, env var lists — loaded on every turn regardless of what was being built. Cut it to 235 lines by moving detail to `docs/` and keeping only what causes a silent production bug if missed on the first line of a new session.

**What resisted me?**

Writing the lint scripts exposed a false positive immediately: `upload-document.ts` calls `validateDocumentFile()` which wraps the Zod schema internally — but the script only checked for a direct schema import and flagged it as non-compliant. The fix was straightforward. The lesson wasn't: proxy validators that satisfy a rule indirectly are easy to miss when you're writing enforcement logic. You have to think about the intent of the rule, not just its surface pattern.

**What did I understand?**

The gap between "I documented this" and "this cannot happen" is where bugs live. Documentation is not enforcement. The question for every rule: at what point in the workflow does violating it become impossible to miss?

---

## Phase 6 Pre-work — Schema Hardening + Upload Hints

**What did I decide?**

Three decisions, all made before writing a line of Phase 6 AI pipeline code.

**1. Self-describing tables.** `document_actions` and `pending_tasks` are two different things — audit trail vs. working list — but they need to carry the same categorical metadata independently. Added `category` and `phase_appears` to `document_actions`, and `action_for` to `pending_tasks`. This means either table can be queried without a join for basic product questions ("what actions were taken for this document?", "which tasks are assigned to the patient?"). The `source_action_id` FK on `pending_tasks` preserves the lineage without coupling the tables for reads.

The alternative was to keep only `pending_tasks` (simpler schema, fewer tables) and derive everything from there. The objection to that: when a document is archived and its tasks are deleted or completed, you lose the audit trail of what Claude extracted from that document. `document_actions` is the immutable record of what was in each file. `pending_tasks` is the coordinator's working list. These are different things and need different tables.

**2. Custom document type via `purpose` field.** When a coordinator selects "Other (custom)" in the upload UI, the custom label is stored in the `purpose` column, not a new `custom_type` column. `type` stays `'other'`. This keeps the enum clean and avoids schema changes for what is ultimately display metadata. The coordinator or Claude can later replace the purpose with a real clinical description.

**3. Parallel input model for upload hints.** Coordinator provides optional hints (type, hospital) before uploading. Hints are seeded into the `documents` row immediately so the UI has something to show while AI runs. Claude then classifies independently — if it disagrees, Claude wins. The coordinator can correct any discrepancy via `DocumentClassificationEditor` after classification. This is the same UX pattern Eka Care uses at upload time.

The alternative was to skip classification when a hint was provided ("trust the coordinator"). Rejected: a coordinator who selects "Lab Report" and uploads a bill causes downstream errors in translation and task generation. Claude reading the actual document is not optional.

**What resisted me?**

The schema review conversation. Every time we looked at the tables, a new gap appeared — `category` missing from `document_actions`, `action_for` missing from `pending_tasks`, hints not yet anywhere in the schema. Each gap on its own looked small. What resisted was accepting that the right move was to stop, enumerate all the gaps at once, and fix the schema before touching any AI code. The pull to just start writing `classify.ts` was strong.

The structural review turned up the right question: "can I answer basic product questions from a single table, or do I need joins for everything?" When the answer was "joins for everything" on both tables, the schema wasn't done yet.

**What did I understand?**

The difference between a schema that is structurally correct and one that is query-practical. Normalization tells you not to repeat data. But a medical product where you need to surface "what did Claude extract from this document?" and "what is the coordinator's current task list?" in different UI contexts benefits from deliberate denormalization — each table carries enough to answer its own most common question.

Upload hints also made me understand the value of showing something immediately vs. showing nothing until AI runs. The hint-seeding pattern (write hint to DB → show in UI → AI runs → UI updates) is a small UX detail but it changes whether the product feels responsive or dead while a 3-second Claude call runs.

**One thing that surprised me:**

The `purpose` field as a dual-use column. It was designed to hold Claude's plain-language purpose description ("Pre-operation blood work"). It turns out it also works perfectly as the custom type label when `type='other'`. The field has exactly the right semantics — a human-readable description of what this document is — regardless of whether Claude or the coordinator wrote it.

---

## Phase 6 — AI Pipeline + Type Enforcement

**What did I decide?**

Three decisions, made in sequence as the problems surfaced.

**1. Verified the AI SDK against installed node_modules, not docs.**
The subagent research returned code using `generateObject` and `mimeType` on `FilePart`. Both were wrong for the installed `ai@6.0.198` — `generateObject` is `@deprecated`, and the field is `mediaType` not `mimeType`. Neither produces a TypeScript error that's immediately obvious; `generateObject` still compiles with a deprecation warning, and the wrong field name would only surface at runtime. The decision: before writing any AI SDK call, read the installed package types directly from `node_modules`. The installed package is always ground truth. Web docs and training data are not.

The correct pattern:
```ts
const result = await generateText({
  model: anthropic(AI_MODELS.classify),
  output: Output.object({ schema: ClassificationSchema }),
  messages: [{ role: 'user', content: [
    { type: 'text', text: prompt },
    { type: 'file', data: fileBuffer, mediaType: mimeType },
  ]}],
})
if (result.output === undefined) throw new NoOutputGeneratedError()
return result.output
```

**2. `name_is_guessed` as an explicit boolean in the classification schema.**
The first version of the classification prompt said "use the exact name if visible, otherwise infer a descriptive fallback." That hid the inference behind a clean name — the coordinator and the audit trail had no way to know if Claude read the name or made it up. Added `name_is_guessed: boolean` to `ClassificationSchema` and stored `[Inferred]` as a prefix in the DB when true. Accuracy in health records is non-negotiable. Guesses have to be labelled.

**3. Unreadable document returns an explicit failure signal, not silent best-guesses.**
The original prompt's fallback behaviour was "classify as other and do your best." That means a document that is a blurred photograph of a prescription could come back as `type: "other"`, `suggested_purpose: "Medication instructions"` — which looks like a successful classification but is fabricated. Changed the rule: if the document is unreadable or corrupt, return `suggested_purpose: "Document unreadable — please re-upload a clearer scan"` and null everything else. No fabrication. Silent best-guesses on health documents cause real harm downstream.

**4. Single source of truth for all DB-aligned union types.**
Ten-plus files each had slightly different inline definitions of the same types — `DocumentType`, `EpisodeStatus`, `TaskCategory`, etc. They were close enough to not cause obvious errors, but far enough to drift when a DB enum changes. Created `lib/types/domain.ts` as the single owner; all components, actions, and AI schemas import from there, never redefine. The check is machine-backed: `pnpm lint:types` (`scripts/check-types.mjs`) fails CI on any inline redefinition. A `PostToolUse` hook fires the same warning the moment a file is written.

**What resisted me?**

The subagent research produced confident, syntactically valid code with two silent bugs. This is the hard version of "garbage in, garbage out" — the input wasn't obviously wrong, and the output wasn't obviously broken. The resistance was accepting that the only safe path is to verify the API surface directly from the installed source, every time, before writing a single call. The temptation to trust a well-structured response from an AI that sounds authoritative is real.

The type audit also resisted. Once the first duplicate definition was found, the instinct was to fix that one and move on. What actually had to happen was stopping, enumerating every file that could have an inline type definition, and fixing all of them at once — because partial cleanup leaves the codebase in a state where the rule is enforced in some files but not others, which is worse than no rule at all.

**What did I understand?**

The difference between a lint rule and an enforcement layer. A rule written in a doc gets read once. A lint script you have to remember to run fails silently when forgotten. A `PostToolUse` hook fires the moment you write the file — before the context window has scrolled past the decision. The same rule in three places (doc, CI script, inline hook) doesn't mean the rule is written three times. It means the feedback arrives at three different points in the workflow, each catching what the others miss.

**One thing that surprised me:**

The `check-types.mjs` script caught a false positive on its own first run: `lib/validation/schemas.ts` defines `DOCUMENT_TYPES` as an `as const` array, which the regex read as a type definition. The fix was a one-line exemption. But the false positive was useful: it proved the script was actually scanning the right files with the right pattern. A lint script that never fires is indistinguishable from one that has a bug. The false positive was evidence the tool was working.

---

## Phase 7 — Coordinator Dashboard Display

**What did I decide?**

Two decisions, made in sequence.

**1. Data Access Layer (DAL) over inline page fetchers.**
The first version of the coordinator dashboard page had three private async functions at the bottom — `fetchEpisodeDocuments`, `fetchEpisodeSummary`, `fetchOpenTaskCounts` — each taking a shared Supabase client as a parameter. It worked, but it meant the coordinator page owned all the data logic, and the patient page (Phase 8) would have to duplicate it. The decision: extract to `lib/dal/` with `import 'server-only'` and React `cache()` on every function. Each function owns its own Supabase client. The page becomes three import lines and one `Promise.all`. When the patient page needs the same data, it's the same import — no duplication, no drift.

The alternative was to keep fetchers in the page files and accept the duplication. Rejected because the DAL pattern also removes an easy-to-miss mistake: passing a stale Supabase client across functions that have different session contexts.

**2. `EpisodeTimeline` as a client component receiving data as props, not fetching it.**
The timeline needs to manage `selectedId` state (which document card is open in the sheet). That means `'use client'`. The question was whether it should also fetch its own data via a server action or prop. Chose props: the RSC page fetches everything, passes it down. The component is pure UI — state + rendering, no network calls. This also makes stories trivial (pass fixture data, no mocking required) and keeps the component testable in isolation.

**What resisted me?**

The Supabase nested select for `documents → document_translations → document_actions` returns the joined rows differently depending on cardinality — sometimes an array, sometimes a single object, sometimes null. The mapping code had to handle all three cases with `Array.isArray()` checks. The shape is not documented clearly; it had to be inferred from what actually came back.

**What did I understand?**

`React.cache()` is not the same as HTTP caching or `unstable_cache`. It deduplicates identical function calls within a single request — if the coordinator dashboard and a layout component both call `getActiveEpisode(patientId)` with the same argument, Supabase is only hit once. The cost is zero. The benefit is that you can call DAL functions freely across RSC components without worrying about over-fetching.

---

## Phase 8 — Patient View

**What did I decide?**

**1. `what_it_means` visible to patients.**
The spec said "patient sees `plain_language` only." After looking at the actual content Claude generates, `what_it_means` is clinically useful context — it explains the significance of the document, not just what it says. Hiding it from patients makes the experience thinner without a real privacy or safety justification. Coordinator-only information is the *actions* section (task assignments, operational next steps). Plain language + what it means = what a patient needs to understand their own care.

**2. `PatientSummaryPanel` as a separate component from `EpisodeSummaryPanel`.**
The coordinator's episode summary panel shows: status badge, task counts, visit purpose, timeline summary. The patient's panel should show: plain-language status sentence, visit purpose, timeline summary. Same data, different framing. Rather than adding `viewerRole` conditionals inside `EpisodeSummaryPanel`, created a separate `PatientSummaryPanel`. The coordinator and patient views will diverge further as the product grows — a shared component with role-branching becomes harder to reason about at each branch. Two components, each with one job.

**What resisted me?**

The proxy redirect loop. After patient login, the auth action redirects to `/dashboard`. The proxy sees a patient on `/dashboard`, looks up their `patient_access` row, and redirects to `/patient/[id]`. This should work — but the first implementation of the proxy Rule 2 extracted `patientId` from `pathname.split('/')[2]`, which is `undefined` for `/dashboard` (no segment at index 2). The result was a redirect to `/patient/undefined`, which the proxy then had no rule for, which passed through to a 404. The loop was silent — no error, just the browser spinning.

The fix required two changes: the proxy Rule 2 now queries `patient_access` when `patientId` is missing from the URL, and the auth action now does the same lookup post-login and redirects patients directly to `/patient/[id]` instead of always going to `/dashboard`.

**What did I understand?**

Smoke testing with Playwright caught a UX issue that unit tests and type checking cannot: the empty state message in `EpisodeTimeline` said "upload the first one above" — which is meaningless and confusing to a patient who has no upload capability. The automated test found it because it checked the actual rendered text. The fix is one conditional, but finding it required running the thing in a browser as the actual user.

The deeper lesson: role-aware empty states are as important as role-aware data. A page that correctly hides coordinator data but shows coordinator-oriented copy is still broken from the patient's perspective.

**One thing that surprised me:**

The patient account setup exposed that the Supabase project had no patient auth user at all — only a coordinator and a patient *record*. The patient record (the medical subject) and the patient auth user (the person who logs in) are two different things linked by `patient_access`. It is easy to create one without the other. The data model is correct — but the seed data has to explicitly create both and link them, or the patient view can never be tested end-to-end.

---

## Phase 9 — Pending Tasks Page

**What did I decide?**

**1. Inline confirm banner instead of an `AlertDialog` modal.**
The spec called for a confirm dialog before marking a task as resolved. The natural choice was `AlertDialog` from Shadcn — but `alert-dialog` wasn't installed, and the decision was whether to add a new primitive or work with what exists. Chose an inline confirm banner (a row appearing between the task list and the page footer) instead. It requires no new Shadcn component, stays in the same scroll context as the task, and is harder to accidentally dismiss (no escape/click-outside). The modal is technically "correct" UX pattern, but the inline banner is safer for a high-stakes action where accidental confirmation matters.

**2. Optimistic resolve with automatic rollback on failure.**
When the coordinator clicks "Mark as done", the UI immediately applies strikethrough (optimistic update via a local `Set<string>`). The server action runs in the background via `useTransition`. If the server action returns `ok: false`, the `Set` entry is deleted and the strikethrough reverts. This means the UI never blocks on the network call, but also never lies permanently. The alternative (wait for server confirmation before updating) creates a sluggish feel for what should be an instant action — especially on a hospital Wi-Fi connection.

**3. `view toggle` persistence via `localStorage` only.**
View preference (list vs card) is saved to `localStorage` rather than the database. It is purely a display preference, not data — it has no impact on any other user, is ephemeral per device, and adding a DB column for it would be over-engineering. The default is `list`. localStorage is read in a `useEffect` after mount, so the initial render always shows list view (SSR-safe, no hydration mismatch).

**What resisted me?**

The Vitest test cascade from Vite dependency optimization. Adding `next/link` to `EpisodeSummaryPanel` (which needed it for the "View all tasks" link) caused the Vite optimizer to invalidate its cache mid-test-run — this kills active connections to the `axe-core` chunk, which causes all simultaneously-running Storybook stories to fail with a fetch error. The fix: add `next/link` to `optimizeDeps.include` in `vitest.config.ts` so Vite bundles it upfront rather than discovering it lazily during a test run. The second problem: the `ResolveFlow` story assumed list view was active, but `localStorage` could persist `card` from a prior story. Fix: click the list view button explicitly at the start of that story's `play` function.

**What did I understand?**

The difference between `server-only` import errors and RLS enforcement. Both prevent unauthorized data access, but at different layers. `server-only` throws a build error if a DAL file is imported client-side — it makes the wrong pattern physically impossible. RLS throws a runtime database error if a query violates access policies — it makes the wrong pattern fail safely. The combination means: the wrong import path doesn't compile, and even if it did, the database query would be rejected. Defense in depth is not paranoia. It is the difference between "this should not happen" and "this cannot happen."

---

## ESLint Migration — Architecture Enforcement Overhaul

**What did I decide?**

**Drop the three regex scripts entirely; move everything into ESLint.**
`check-primitives.mjs`, `check-schemas.mjs`, and `check-types.mjs` were replaced by five custom AST rules in `eslint.config.mjs` under the `carealig/` plugin namespace. `check-stories.mjs` stays — it's a filesystem existence check that ESLint can't do per-file. The trigger for this was a multiline `<button\n  onClick=...` tag that passed the regex but violated the primitive rule. The decision was not to patch the regex, but to eliminate the class of problem: regex applied to source text is permanently second-class to AST analysis.

Additional standard rules added: `@typescript-eslint/no-unused-vars` (caught the dead `episodePhase` prop class), `no-floating-promises` (caught silent async fire-and-forget), `react-hooks/exhaustive-deps`, `consistent-type-imports`.

**Pre-commit hook via `.githooks/`**, not Husky. No extra runtime dependency. Activated by `git config core.hooksPath .githooks` (auto-runs via `prepare` script on `pnpm install`). Runs `tsc + eslint + check-stories` before every commit — the same sequence as `pnpm lint:arch`.

**What resisted me?**

`eslint-config-next` already registers `@typescript-eslint` as a plugin. Importing and redeclaring it in the same flat config throws a "Cannot redefine plugin" error. Resolution: add rules in a separate config block without re-declaring the plugin — ESLint v9 flat config merges plugin registrations from earlier array entries automatically. `no-floating-promises` also requires `parserOptions.project` for typed linting; adding that to the config block resolved it.

**What did I understand?**

The bugs ESLint found while the codebase was being "enforced" by the old scripts: an unused import in `upload-document.ts` (`getSignedBlobUrl` — dead since the signed URL API moved to the route handler), floating promises on `handleFile()` calls in `DocumentUploadZone` (fire-and-forget errors were silently swallowed), and `setState` inside a `useEffect` for localStorage (correct behaviour, wrong pattern — moved to lazy state initializer). These weren't new bugs introduced in Phase 9. They were pre-existing. The old scripts never saw them because they didn't look for them.

---

## Content Pipeline

When ready to post, paste raw notes from any phase above into a Claude conversation with:

```
Platform: [LinkedIn / X / Blog]
Raw notes: [paste the three answers]
Help me shape this into a post in my voice.
Do not generate content — ask me questions first.
```

---

## Post Ideas (generated from the spec and build journey)

These are not scheduled. They are written when the moment is real.

**Origin posts (write first — before anything technical)**
- The hospital corridor. The folder. Running between departments alone.
- The blood test report I couldn't understand. The Googling. The waiting.

**Thinking posts (write while building)**
- Why I spent the first session writing docs instead of code
- The question that changed my data model: "does the patient always need to know what to do tomorrow?"
- Why I chose Claude over GPT-4 for medical document translation
- What cognitive surrender actually looks like when you're building with AI
- Why silence is a valid output: `actions: []` is correct, not a bug

**Decision posts (write at each milestone)**
- The moment I realised Eka Care was infrastructure, not a competitor
- Why "silence is a valid state" is a product principle, not a feature
- The three concepts that look the same but aren't: auth vs profile vs access grant
- Why the database enforces access, not the application

**Struggle posts (write when it happens — not after)**
- The migration that failed because SQL function bodies compile at definition time
- The afternoon I wanted to skip the spec and just start building
- Why getting a Blob token out of Vercel taught me something about security design
- The Tailwind v4 colour space change that broke my CSS test in exactly the right way

**Launch post (write on final day)**
- Here's what I built. Here's why. Here's the live URL.

---

## Voice Reference

**What your content is:**
Writing about how to think about problems — not how to solve them — because the thinking is what transfers across contexts, not the solution.

**What it is not:**
- Tutorials
- How-to guides
- Feature announcements
- Personal branding performance

**The tone:**
Honest. Direct. Specific. The same voice you use when you catch your own mistake and say "wait, that doesn't feel right."
